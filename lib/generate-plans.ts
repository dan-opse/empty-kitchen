import {
  canCook,
  cloneQtyMap,
  consumeCook,
  evaluateRecipe,
  poolToQtyMap,
} from "@/lib/feasibility";
import { toDefaultUnit } from "@/lib/units";
import type {
  GeneratedPlan,
  Ingredient,
  PlanSlot,
  PlanUsageRow,
  PoolItem,
  PurchasedItem,
  Recipe,
  RecipeIngredient,
  UnitConversion,
} from "@/lib/types";

const PREP_DINNER_THRESHOLD = 30;

type Feasible = {
  recipe: Recipe;
  modified: boolean;
  swaps: { from: string; to: string }[];
  missing_optionals: string[];
};

export function generateCandidatePlans(input: {
  recipes: Recipe[];
  recipeIngredients: RecipeIngredient[];
  ingredients: Ingredient[];
  pool: PoolItem[];
  purchased: PurchasedItem[];
  conversions: UnitConversion[];
}): GeneratedPlan[] {
  const { recipes, recipeIngredients, ingredients, pool, purchased, conversions } = input;
  const qtyMap = poolToQtyMap(pool, ingredients, conversions);
  const feasible: Feasible[] = [];

  for (const recipe of recipes) {
    const result = evaluateRecipe(recipe, recipeIngredients, pool, ingredients, conversions, qtyMap);
    if (result.feasible) {
      feasible.push({
        recipe,
        modified: result.modified,
        swaps: result.swaps,
        missing_optionals: result.missing_optionals,
      });
    }
  }

  if (feasible.length === 0) return [];

  const overlap = overlapMatrix(feasible, recipeIngredients, ingredients);
  const seeds = pickSeeds(feasible, purchased, recipeIngredients, ingredients);
  const clusters: Feasible[][] = [];
  const usedSignatures = new Set<string>();
  const usedRecipes = new Set<string>();

  for (const seed of seeds) {
    const cluster = growCluster(
      seed,
      feasible,
      overlap,
      recipeIngredients,
      ingredients,
      conversions,
      qtyMap,
      usedRecipes,
    );
    const sig = cluster
      .map((c) => c.recipe.recipe_id)
      .sort()
      .join(",");
    if (usedSignatures.has(sig)) continue;
    usedSignatures.add(sig);
    clusters.push(cluster);
    for (const item of cluster) usedRecipes.add(item.recipe.recipe_id);
    if (clusters.length === 3) break;
  }

  while (clusters.length < 3) {
    const extra = feasible.find((f) => !usedRecipes.has(f.recipe.recipe_id)) ?? feasible[clusters.length];
    if (!extra) break;
    const cluster = growCluster(
      extra,
      feasible,
      overlap,
      recipeIngredients,
      ingredients,
      conversions,
      qtyMap,
      usedRecipes,
    );
    const sig = cluster
      .map((c) => c.recipe.recipe_id)
      .sort()
      .join(",");
    if (usedSignatures.has(sig)) {
      clusters.push(rotateCluster(cluster, clusters.length));
    } else {
      usedSignatures.add(sig);
      clusters.push(cluster);
    }
    for (const item of cluster) usedRecipes.add(item.recipe.recipe_id);
  }

  const plans = clusters.slice(0, 3).map((cluster, index) => {
    const expanded = expandTo14(cluster, feasible, recipeIngredients, ingredients, conversions, qtyMap);
    const usage = usageBreakdown(expanded.slots, purchased, recipeIngredients, ingredients, conversions, cluster);
    const overlapScore = clusterOverlap(cluster, overlap);
    const perishScore = perishabilityScore(expanded.slots, recipeIngredients, ingredients);
    const skuCoverage = skuCoveragePct(usage);
    const qtyUtil = quantityUtilPct(usage);
    const grocery = Math.round((qtyUtil * 0.65 + skuCoverage * 0.35) * 10) / 10;
    const combined = grocery + perishScore * 8 + overlapScore * 4;
    return {
      plan_rank: index + 1,
      overlap_score: Math.round(overlapScore * 1000) / 1000,
      grocery_utilization_pct: grocery,
      summary_text: buildSummary(expanded.slots, cluster, purchased, recipeIngredients),
      slots: expanded.slots,
      usage,
      _sort: combined,
    };
  });

  plans.sort((a, b) => b._sort - a._sort);
  return plans.map((plan, i) => ({
    plan_rank: i + 1,
    overlap_score: plan.overlap_score,
    grocery_utilization_pct: plan.grocery_utilization_pct,
    summary_text: plan.summary_text,
    slots: plan.slots,
    usage: plan.usage,
  }));
}

function rotateCluster(cluster: Feasible[], n: number): Feasible[] {
  if (cluster.length === 0) return cluster;
  const i = n % cluster.length;
  return [...cluster.slice(i), ...cluster.slice(0, i)];
}

function overlapMatrix(
  feasible: Feasible[],
  rows: RecipeIngredient[],
  ingredients: Ingredient[],
): Map<string, number> {
  const nonStaple = (id: string) =>
    new Set(
      rows
        .filter((r) => r.recipe_id === id && r.tier !== "staple" && !r.substitute_for)
        .filter((r) => !ingredients.find((i) => i.ingredient_name === r.ingredient_name)?.is_staple)
        .map((r) => r.ingredient_name),
    );
  const sets = new Map(feasible.map((f) => [f.recipe.recipe_id, nonStaple(f.recipe.recipe_id)]));
  const map = new Map<string, number>();
  for (let i = 0; i < feasible.length; i++) {
    for (let j = i + 1; j < feasible.length; j++) {
      const a = sets.get(feasible[i].recipe.recipe_id)!;
      const b = sets.get(feasible[j].recipe.recipe_id)!;
      let shared = 0;
      for (const name of a) if (b.has(name)) shared += 1;
      const denom = Math.max(1, Math.min(a.size, b.size));
      const score = shared / denom;
      map.set(pairKey(feasible[i].recipe.recipe_id, feasible[j].recipe.recipe_id), score);
    }
  }
  return map;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function pickSeeds(
  feasible: Feasible[],
  purchased: PurchasedItem[],
  rows: RecipeIngredient[],
  ingredients: Ingredient[],
): Feasible[] {
  const purchasedNames = purchased
    .filter((p) => !ingredients.find((i) => i.ingredient_name === p.ingredient_name)?.is_staple)
    .map((p) => p.ingredient_name);
  const seeds: Feasible[] = [];
  const usedRecipes = new Set<string>();
  const usedIngredients = new Set<string>();

  for (const name of purchasedNames) {
    if (usedIngredients.has(name)) continue;
    const users = feasible
      .filter((f) => !usedRecipes.has(f.recipe.recipe_id))
      .filter((f) =>
        rows.some(
          (r) =>
            r.recipe_id === f.recipe.recipe_id &&
            r.ingredient_name === name &&
            r.tier === "required" &&
            !r.substitute_for,
        ),
      );
    const pick = users[0];
    if (!pick) continue;
    seeds.push(pick);
    usedRecipes.add(pick.recipe.recipe_id);
    for (const row of rows) {
      if (row.recipe_id === pick.recipe.recipe_id && row.tier === "required" && !row.substitute_for) {
        usedIngredients.add(row.ingredient_name);
      }
    }
    if (seeds.length === 3) break;
  }

  for (const f of feasible) {
    if (seeds.length === 3) break;
    if (!usedRecipes.has(f.recipe.recipe_id)) {
      seeds.push(f);
      usedRecipes.add(f.recipe.recipe_id);
    }
  }
  return seeds.slice(0, 3);
}

function growCluster(
  seed: Feasible,
  feasible: Feasible[],
  overlap: Map<string, number>,
  rows: RecipeIngredient[],
  ingredients: Ingredient[],
  conversions: UnitConversion[],
  qtyMap: Map<string, { qty: number; unit: string }>,
  avoidIds: Set<string>,
): Feasible[] {
  const cluster = [seed];
  const remaining = feasible.filter((f) => f.recipe.recipe_id !== seed.recipe.recipe_id);
  const targetMin = Math.min(5, feasible.length);
  const targetMax = Math.min(8, feasible.length);

  while (cluster.length < targetMax) {
    let best: Feasible | null = null;
    let bestScore = -Infinity;
    for (const candidate of remaining) {
      if (!clusterFitsQty([...cluster, candidate], rows, ingredients, conversions, qtyMap)) continue;
      const avg =
        cluster.reduce(
          (sum, c) => sum + (overlap.get(pairKey(c.recipe.recipe_id, candidate.recipe.recipe_id)) ?? 0),
          0,
        ) / cluster.length;
      const novelty = avoidIds.has(candidate.recipe.recipe_id) ? -0.45 : 0.15;
      const score = avg + novelty;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (!best) break;
    cluster.push(best);
    remaining.splice(remaining.indexOf(best), 1);
    if (cluster.length >= targetMin && bestScore < 0.05) break;
  }
  return cluster;
}

function clusterFitsQty(
  cluster: Feasible[],
  rows: RecipeIngredient[],
  ingredients: Ingredient[],
  conversions: UnitConversion[],
  qtyMap: Map<string, { qty: number; unit: string }>,
): boolean {
  const copy = cloneQtyMap(qtyMap);
  for (const item of cluster) {
    if (!consumeCook(item.recipe.recipe_id, rows, copy, ingredients, conversions, item.swaps)) {
      return false;
    }
  }
  return true;
}

function expandTo14(
  cluster: Feasible[],
  allFeasible: Feasible[],
  rows: RecipeIngredient[],
  ingredients: Ingredient[],
  conversions: UnitConversion[],
  qtyMap: Map<string, { qty: number; unit: string }>,
): { slots: PlanSlot[] } {
  const slots: PlanSlot[] = [];
  for (let day = 1; day <= 7; day++) {
    slots.push(emptySlot(day, "lunch"));
    slots.push(emptySlot(day, "dinner"));
  }

  const working = cloneQtyMap(qtyMap);
  const byId = new Map(allFeasible.map((f) => [f.recipe.recipe_id, f]));
  const perishOrder = [...cluster].sort((a, b) => {
    const pa = recipePerish(a.recipe.recipe_id, rows, ingredients);
    const pb = recipePerish(b.recipe.recipe_id, rows, ingredients);
    if (pb !== pa) return pb - pa;
    return b.recipe.prep_time_minutes - a.recipe.prep_time_minutes;
  });

  for (const item of perishOrder) {
    const preferred: "lunch" | "dinner" =
      item.recipe.prep_time_minutes >= PREP_DINNER_THRESHOLD ? "dinner" : "lunch";
    const placed = placeCook(slots, item, preferred, working, rows, ingredients, conversions);
    if (!placed) continue;
    const cookSlot = slots.find(
      (s) => s.recipe_id === item.recipe.recipe_id && !s.is_leftover,
    );
    if (!cookSlot || cookSlot.day_number >= 7) continue;
    const leftoverMeal = cookSlot.meal_slot;
    const next = slots.find(
      (s) => s.day_number === cookSlot.day_number + 1 && s.meal_slot === leftoverMeal && !s.recipe_id,
    );
    if (next) assignSlot(next, item, true);
  }

  for (const slot of slots) {
    if (slot.recipe_id) continue;
    const prev = slots.find(
      (s) => s.day_number === slot.day_number - 1 && s.meal_slot === slot.meal_slot && s.recipe_id,
    );
    if (prev?.recipe_id && !prev.is_leftover) {
      const item = byId.get(prev.recipe_id);
      if (item) {
        assignSlot(slot, item, true);
        continue;
      }
    }
    const nextCook =
      cluster.find((item) =>
        canCook(item.recipe.recipe_id, rows, working, ingredients, conversions, item.swaps),
      ) ??
      allFeasible.find((item) =>
        canCook(item.recipe.recipe_id, rows, working, ingredients, conversions, item.swaps),
      );
    if (nextCook) {
      const ok = consumeCook(
        nextCook.recipe.recipe_id,
        rows,
        working,
        ingredients,
        conversions,
        nextCook.swaps,
      );
      if (ok) {
        assignSlot(slot, nextCook, false);
        continue;
      }
    }
    if (prev?.recipe_id) {
      const item = byId.get(prev.recipe_id);
      if (item) assignSlot(slot, item, true);
    }
  }

  return { slots };
}

function emptySlot(day: number, meal: "lunch" | "dinner"): PlanSlot {
  return {
    day_number: day,
    meal_slot: meal,
    recipe_id: null,
    recipe_name: null,
    prep_time_minutes: null,
    cuisine_tag: null,
    is_leftover: false,
    modified: false,
    swaps: [],
    missing_optionals: [],
  };
}

function assignSlot(slot: PlanSlot, item: Feasible, leftover: boolean) {
  slot.recipe_id = item.recipe.recipe_id;
  slot.recipe_name = item.recipe.recipe_name;
  slot.prep_time_minutes = item.recipe.prep_time_minutes;
  slot.cuisine_tag = item.recipe.cuisine_tag;
  slot.is_leftover = leftover;
  slot.modified = item.modified;
  slot.swaps = leftover ? [] : item.swaps;
  slot.missing_optionals = leftover ? [] : item.missing_optionals;
}

function placeCook(
  slots: PlanSlot[],
  item: Feasible,
  preferred: "lunch" | "dinner",
  qtyMap: Map<string, { qty: number; unit: string }>,
  rows: RecipeIngredient[],
  ingredients: Ingredient[],
  conversions: UnitConversion[],
): boolean {
  const other = preferred === "dinner" ? "lunch" : "dinner";
  for (let day = 1; day <= 7; day++) {
    for (const meal of [preferred, other] as const) {
      const slot = slots.find((s) => s.day_number === day && s.meal_slot === meal);
      if (!slot || slot.recipe_id) continue;
      if (!canCook(item.recipe.recipe_id, rows, qtyMap, ingredients, conversions, item.swaps)) {
        return false;
      }
      const ok = consumeCook(item.recipe.recipe_id, rows, qtyMap, ingredients, conversions, item.swaps);
      if (!ok) return false;
      assignSlot(slot, item, false);
      return true;
    }
  }
  return false;
}

function recipePerish(recipeId: string, rows: RecipeIngredient[], ingredients: Ingredient[]): number {
  const rank = { high: 3, medium: 2, low: 1 };
  let max = 0;
  for (const row of rows) {
    if (row.recipe_id !== recipeId || row.tier === "staple" || row.substitute_for) continue;
    const meta = ingredients.find((i) => i.ingredient_name === row.ingredient_name);
    if (!meta || meta.is_staple) continue;
    max = Math.max(max, rank[meta.perishability]);
  }
  return max;
}

function clusterOverlap(cluster: Feasible[], overlap: Map<string, number>): number {
  if (cluster.length < 2) return 0;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < cluster.length; i++) {
    for (let j = i + 1; j < cluster.length; j++) {
      sum += overlap.get(pairKey(cluster[i].recipe.recipe_id, cluster[j].recipe.recipe_id)) ?? 0;
      n += 1;
    }
  }
  return n ? sum / n : 0;
}

function usageBreakdown(
  slots: PlanSlot[],
  purchased: PurchasedItem[],
  rows: RecipeIngredient[],
  ingredients: Ingredient[],
  conversions: UnitConversion[],
  cluster: Feasible[],
): PlanUsageRow[] {
  const byId = new Map(cluster.map((c) => [c.recipe.recipe_id, c]));
  const used = new Map<string, number>();
  const units = new Map<string, string>();

  for (const slot of slots) {
    if (!slot.recipe_id || slot.is_leftover) continue;
    const item = byId.get(slot.recipe_id);
    const swaps = new Map((item?.swaps ?? slot.swaps).map((s) => [s.from, s.to]));
    const needed = rows.filter((r) => r.recipe_id === slot.recipe_id && !r.substitute_for);
    for (const row of needed) {
      const meta = ingredients.find((i) => i.ingredient_name === row.ingredient_name);
      if (row.tier === "staple" || meta?.is_staple) continue;
      const name = swaps.get(row.ingredient_name) ?? row.ingredient_name;
      const useRow =
        name === row.ingredient_name
          ? row
          : rows.find((r) => r.recipe_id === slot.recipe_id && r.ingredient_name === name) ?? row;
      const useMeta = ingredients.find((i) => i.ingredient_name === name);
      const converted = toDefaultUnit(
        useRow.quantity,
        useRow.unit,
        useMeta?.default_unit ?? useRow.unit,
        conversions,
      );
      if (!converted.ok) continue;
      used.set(name, (used.get(name) ?? 0) + converted.qty);
      units.set(name, converted.unit);
    }
  }

  return purchased.map((p) => {
    const meta = ingredients.find((i) => i.ingredient_name === p.ingredient_name);
    const converted = toDefaultUnit(p.quantity, p.unit, meta?.default_unit ?? p.unit, conversions);
    const unit = converted.ok ? converted.unit : p.unit;
    const bought = converted.ok ? converted.qty : p.quantity;
    const consumed = used.get(p.ingredient_name) ?? 0;
    return {
      ingredient_name: p.ingredient_name,
      used_qty: Math.min(consumed, bought),
      leftover_qty: Math.max(0, bought - consumed),
      unit,
    };
  });
}

function quantityUtilPct(usage: PlanUsageRow[]): number {
  const bought = usage.reduce((s, u) => s + u.used_qty + u.leftover_qty, 0);
  const used = usage.reduce((s, u) => s + u.used_qty, 0);
  if (bought <= 0) return 0;
  return (used / bought) * 100;
}

function skuCoveragePct(usage: PlanUsageRow[]): number {
  if (usage.length === 0) return 0;
  const used = usage.filter((u) => u.used_qty > 0).length;
  return (used / usage.length) * 100;
}

function perishabilityScore(
  slots: PlanSlot[],
  rows: RecipeIngredient[],
  ingredients: Ingredient[],
): number {
  const cooks = slots.filter((s) => s.recipe_id && !s.is_leftover);
  if (cooks.length === 0) return 0;
  let sum = 0;
  for (const cook of cooks) {
    const perish = recipePerish(cook.recipe_id!, rows, ingredients);
    const early = 1 - (cook.day_number - 1) / 6;
    sum += perish >= 3 ? early : perish >= 2 ? early * 0.5 : 0.3;
  }
  return sum / cooks.length;
}

function buildSummary(
  slots: PlanSlot[],
  cluster: Feasible[],
  purchased: PurchasedItem[],
  rows: RecipeIngredient[],
): string {
  const cooks = slots.filter((s) => s.recipe_id && !s.is_leftover);
  const usedNames = new Map<string, number>();
  for (const item of cluster) {
    for (const row of rows) {
      if (row.recipe_id !== item.recipe.recipe_id || row.tier !== "required" || row.substitute_for) continue;
      if (purchased.some((p) => p.ingredient_name === row.ingredient_name)) {
        usedNames.set(row.ingredient_name, (usedNames.get(row.ingredient_name) ?? 0) + 1);
      }
    }
  }
  const top = [...usedNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n);
  const parts: string[] = [];
  if (top.length) parts.push(`${top.join(" and ")} forward`);
  const earlyFish = cooks.some((c) => {
    if (c.day_number > 2) return false;
    return rows.some(
      (r) =>
        r.recipe_id === c.recipe_id &&
        /salmon|fish|tuna/.test(r.ingredient_name) &&
        !r.substitute_for,
    );
  });
  if (earlyFish) parts.push("fish cooked early");
  const dinners = cooks.filter((c) => c.meal_slot === "dinner");
  const avgDinner =
    dinners.reduce((s, c) => s + (c.prep_time_minutes ?? 0), 0) / Math.max(1, dinners.length);
  if (avgDinner >= PREP_DINNER_THRESHOLD) parts.push("longer prep on dinners");
  const leftoverCount = slots.filter((s) => s.is_leftover).length;
  if (leftoverCount) parts.push(`${leftoverCount} leftover suggestions`);
  if (cluster.some((c) => c.modified)) parts.push("some recipes marked modified");
  return parts.join("; ") || `${cluster.length} cooks covering the week`;
}
