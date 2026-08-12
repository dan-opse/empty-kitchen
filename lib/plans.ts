import { getSupabase } from "@/lib/supabase";
import { addDaysISO, newId, todayISO } from "@/lib/dates";
import { generateCandidatePlans } from "@/lib/generate-plans";
import { polishSummary } from "@/lib/openai";
import { buildPool, upsertLeftover } from "@/lib/pantry";
import {
  listConversions,
  listIngredients,
  listRecipeIngredients,
  listRecipes,
} from "@/lib/catalog";
import type {
  ActiveWeek,
  MealDetail,
  MealSlot,
  PlanCandidate,
  PlanSlot,
  PlanUsageRow,
  PurchasedItem,
} from "@/lib/types";

type SlotRow = {
  plan_id: string;
  day_number: number;
  meal_slot: MealSlot;
  recipe_id: string | null;
  is_leftover: boolean;
  modified?: boolean;
  swaps?: { from: string; to: string }[];
  missing_optionals?: string[];
};

export async function persistGeneration(input: {
  receiptId: string;
  purchased: PurchasedItem[];
}): Promise<{ generationId: string; planCount: number }> {
  const [recipes, recipeIngredients, ingredients, conversions] = await Promise.all([
    listRecipes(),
    listRecipeIngredients(),
    listIngredients(),
    listConversions(),
  ]);
  const pool = await buildPool(input.purchased);

  const generated = generateCandidatePlans({
    recipes,
    recipeIngredients,
    ingredients,
    pool,
    purchased: input.purchased,
    conversions,
  });

  if (generated.length === 0) {
    throw new Error(
      "No feasible recipes for this haul. Each sample recipe needs every required ingredient (staples aside). Try “Test haul that works” on Add groceries, or add more items on this screen.",
    );
  }

  const sb = getSupabase();
  const generationId = newId("gen");
  const startDate = todayISO();

  const { error: genError } = await sb.from("weekly_plan_generations").insert({
    generation_id: generationId,
    start_date: startDate,
    receipt_id: input.receiptId,
  });
  if (genError) throw genError;

  await sb.from("weekly_plans").update({ selected: false }).eq("selected", true);

  for (const plan of generated) {
    const planId = newId("plan");
    const summary = await polishSummary(plan.summary_text);
    const snapshot = plan.slots;
    const { error: planError } = await sb.from("weekly_plans").insert({
      plan_id: planId,
      generation_id: generationId,
      plan_rank: plan.plan_rank,
      overlap_score: plan.overlap_score,
      grocery_utilization_pct: plan.grocery_utilization_pct,
      summary_text: summary,
      selected: false,
      slots_snapshot: snapshot,
      usage: plan.usage,
    });
    if (planError) throw planError;

    const slotRows = plan.slots.map((slot) => ({
      plan_id: planId,
      day_number: slot.day_number,
      meal_slot: slot.meal_slot,
      recipe_id: slot.recipe_id,
      is_leftover: slot.is_leftover,
      modified: slot.modified,
      swaps: slot.swaps,
      missing_optionals: slot.missing_optionals,
    }));
    const { error: slotError } = await sb.from("weekly_plan_slots").insert(slotRows);
    if (slotError) throw slotError;
  }

  return { generationId, planCount: generated.length };
}

export async function getActiveWeek(): Promise<ActiveWeek | null> {
  const sb = getSupabase();
  const { data: selected, error } = await sb
    .from("weekly_plans")
    .select("*")
    .eq("selected", true)
    .maybeSingle();
  if (error) throw error;
  if (!selected) return null;

  const { data: generation, error: gErr } = await sb
    .from("weekly_plan_generations")
    .select("*")
    .eq("generation_id", selected.generation_id)
    .single();
  if (gErr) throw gErr;

  const slots = await loadSlots(selected.plan_id);
  const candidates = await loadCandidates(selected.generation_id);

  return {
    plan_id: selected.plan_id,
    generation_id: selected.generation_id,
    start_date: generation.start_date,
    summary_text: selected.summary_text,
    grocery_utilization_pct: Number(selected.grocery_utilization_pct),
    plan_rank: selected.plan_rank,
    slots,
    candidates,
  };
}

export async function getLatestUnselectedGeneration(): Promise<{
  generation_id: string;
  start_date: string;
  candidates: PlanCandidate[];
} | null> {
  const sb = getSupabase();
  const { data: selected } = await sb
    .from("weekly_plans")
    .select("plan_id")
    .eq("selected", true)
    .maybeSingle();
  if (selected) return null;

  const { data: gens, error } = await sb
    .from("weekly_plan_generations")
    .select("*")
    .order("start_date", { ascending: false })
    .limit(1);
  if (error) throw error;
  const gen = gens?.[0];
  if (!gen) return null;
  const candidates = await loadCandidates(gen.generation_id);
  if (candidates.length === 0) return null;
  return { generation_id: gen.generation_id, start_date: gen.start_date, candidates };
}

export async function loadCandidates(generationId: string): Promise<PlanCandidate[]> {
  const sb = getSupabase();
  const { data: plans, error } = await sb
    .from("weekly_plans")
    .select("*")
    .eq("generation_id", generationId)
    .order("plan_rank");
  if (error) throw error;

  const result: PlanCandidate[] = [];
  for (const plan of plans ?? []) {
    const slots = await loadSlots(plan.plan_id);
    const lunch = slots.find((s) => s.day_number === 1 && s.meal_slot === "lunch");
    const dinner = slots.find((s) => s.day_number === 1 && s.meal_slot === "dinner");
    result.push({
      plan_id: plan.plan_id,
      plan_rank: plan.plan_rank,
      summary_text: plan.summary_text,
      grocery_utilization_pct: Number(plan.grocery_utilization_pct),
      selected: plan.selected,
      day1: {
        lunch: lunch?.recipe_name ?? null,
        dinner: dinner?.recipe_name ?? null,
      },
    });
  }
  return result;
}

export async function loadSlots(planId: string): Promise<PlanSlot[]> {
  const sb = getSupabase();
  const { data: rows, error } = await sb
    .from("weekly_plan_slots")
    .select("*")
    .eq("plan_id", planId)
    .order("day_number");
  if (error) throw error;

  const recipeIds = [...new Set((rows ?? []).map((r) => r.recipe_id).filter(Boolean))] as string[];
  let recipes: { recipe_id: string; recipe_name: string; prep_time_minutes: number; cuisine_tag: string | null }[] =
    [];
  if (recipeIds.length) {
    const { data, error: rErr } = await sb
      .from("recipes")
      .select("recipe_id, recipe_name, prep_time_minutes, cuisine_tag")
      .in("recipe_id", recipeIds);
    if (rErr) throw rErr;
    recipes = data ?? [];
  }
  const byId = new Map(recipes.map((r) => [r.recipe_id, r]));

  return (rows ?? []).map((row) => {
    const recipe = row.recipe_id ? byId.get(row.recipe_id) : null;
    return {
      day_number: row.day_number,
      meal_slot: row.meal_slot,
      recipe_id: row.recipe_id,
      recipe_name: recipe?.recipe_name ?? null,
      prep_time_minutes: recipe?.prep_time_minutes ?? null,
      cuisine_tag: recipe?.cuisine_tag ?? null,
      is_leftover: row.is_leftover,
      modified: Boolean(row.modified),
      swaps: (row.swaps as PlanSlot["swaps"]) ?? [],
      missing_optionals: (row.missing_optionals as string[]) ?? [],
    };
  });
}

export async function selectPlan(planId: string): Promise<void> {
  const sb = getSupabase();
  const { data: plan, error } = await sb.from("weekly_plans").select("*").eq("plan_id", planId).single();
  if (error) throw error;

  const { data: previous } = await sb
    .from("weekly_plans")
    .select("*")
    .eq("selected", true)
    .maybeSingle();

  if (previous && previous.plan_id !== planId && previous.slots_snapshot) {
    await sb.from("weekly_plan_slots").delete().eq("plan_id", previous.plan_id);
    const snapshot = previous.slots_snapshot as PlanSlot[];
    await sb.from("weekly_plan_slots").insert(
      snapshot.map((slot) => ({
        plan_id: previous.plan_id,
        day_number: slot.day_number,
        meal_slot: slot.meal_slot,
        recipe_id: slot.recipe_id,
        is_leftover: slot.is_leftover,
        modified: slot.modified,
        swaps: slot.swaps,
        missing_optionals: slot.missing_optionals,
      })),
    );
  }

  await sb.from("weekly_plans").update({ selected: false }).eq("selected", true);
  const { error: selErr } = await sb.from("weekly_plans").update({ selected: true }).eq("plan_id", planId);
  if (selErr) throw selErr;

  const usage = (plan.usage ?? []) as PlanUsageRow[];
  for (const row of usage) {
    if (row.leftover_qty > 0.001) {
      await upsertLeftover({
        ingredient_name: row.ingredient_name,
        quantity: row.leftover_qty,
        unit: row.unit,
        status: "in_stock",
      });
    }
  }
}

export async function removeSlot(planId: string, day: number, meal: MealSlot): Promise<void> {
  const { error } = await getSupabase()
    .from("weekly_plan_slots")
    .update({ recipe_id: null, is_leftover: false, modified: false, swaps: [], missing_optionals: [] })
    .eq("plan_id", planId)
    .eq("day_number", day)
    .eq("meal_slot", meal);
  if (error) throw error;
}

export async function moveSlot(
  planId: string,
  fromDay: number,
  fromMeal: MealSlot,
  toDay: number,
  toMeal: MealSlot,
): Promise<void> {
  const sb = getSupabase();
  const { data: rows, error } = await sb.from("weekly_plan_slots").select("*").eq("plan_id", planId);
  if (error) throw error;
  const from = rows?.find((r) => r.day_number === fromDay && r.meal_slot === fromMeal);
  const to = rows?.find((r) => r.day_number === toDay && r.meal_slot === toMeal);
  if (!from || !to) return;

  const fromPayload = payload(from);
  const toPayload = payload(to);
  await sb.from("weekly_plan_slots").update(toPayload).eq("plan_id", planId).eq("day_number", fromDay).eq("meal_slot", fromMeal);
  await sb.from("weekly_plan_slots").update(fromPayload).eq("plan_id", planId).eq("day_number", toDay).eq("meal_slot", toMeal);
}

function payload(row: SlotRow & Record<string, unknown>) {
  return {
    recipe_id: row.recipe_id,
    is_leftover: row.is_leftover,
    modified: row.modified ?? false,
    swaps: row.swaps ?? [],
    missing_optionals: row.missing_optionals ?? [],
  };
}

export async function pushBackDay(planId: string, day: number, meal: MealSlot): Promise<void> {
  if (day >= 7) {
    await removeSlot(planId, day, meal);
    return;
  }
  const sb = getSupabase();
  const { data: rows, error } = await sb
    .from("weekly_plan_slots")
    .select("*")
    .eq("plan_id", planId)
    .eq("meal_slot", meal)
    .order("day_number");
  if (error) throw error;
  const byDay = new Map((rows ?? []).map((r) => [r.day_number as number, r]));

  for (let d = 7; d > day; d--) {
    const src = byDay.get(d - 1);
    const payloadRow = src
      ? payload(src)
      : { recipe_id: null, is_leftover: false, modified: false, swaps: [], missing_optionals: [] };
    await sb.from("weekly_plan_slots").update(payloadRow).eq("plan_id", planId).eq("day_number", d).eq("meal_slot", meal);
  }
  await sb
    .from("weekly_plan_slots")
    .update({ recipe_id: null, is_leftover: false, modified: false, swaps: [], missing_optionals: [] })
    .eq("plan_id", planId)
    .eq("day_number", day)
    .eq("meal_slot", meal);
}

export async function getMealDetail(
  planId: string,
  day: number,
  meal: MealSlot,
): Promise<MealDetail | null> {
  const slots = await loadSlots(planId);
  const slot = slots.find((s) => s.day_number === day && s.meal_slot === meal);
  if (!slot) return null;
  if (!slot.recipe_id) {
    return { slot, instructions: null, notes: null, ingredients: [] };
  }
  const sb = getSupabase();
  const { data: recipe, error } = await sb.from("recipes").select("*").eq("recipe_id", slot.recipe_id).single();
  if (error) throw error;
  const { data: rows, error: rErr } = await sb
    .from("recipe_ingredients")
    .select("*")
    .eq("recipe_id", slot.recipe_id);
  if (rErr) throw rErr;

  const swapTo = new Map(slot.swaps.map((s) => [s.from, s.to]));
  const ingredients = (rows ?? [])
    .filter((r) => !r.substitute_for)
    .map((r) => {
      const swapped = swapTo.get(r.ingredient_name);
      const missing = slot.missing_optionals.includes(r.ingredient_name);
      const use = swapped
        ? (rows ?? []).find((x) => x.ingredient_name === swapped) ?? r
        : r;
      return {
        name: swapped ?? r.ingredient_name,
        quantity: Number(use.quantity),
        unit: use.unit,
        tier: r.tier,
        swappedFrom: swapped ? r.ingredient_name : undefined,
        missing,
      };
    });

  return {
    slot,
    instructions: recipe.instructions,
    notes: recipe.notes,
    ingredients,
  };
}

export function windowDates(startDate: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(startDate, i));
}
