import {
  canCook,
  cloneQtyMap,
  consumeCook,
  evaluateRecipe,
  poolToQtyMap,
} from "@/lib/feasibility";
import { indexByName } from "@/lib/catalog";
import { toDefaultUnit } from "@/lib/units";
import type {
  GeneratedPlan,
  GenerateMode,
  GroceryListRow,
  Ingredient,
  PlanSlot,
  PlanUsageRow,
  PoolItem,
  PurchasedItem,
  QtyMap,
  Recipe,
  RecipeIngredient,
  UnitConversion,
} from "@/lib/types";

const PREP_DINNER_THRESHOLD = 30;
const SENTINEL_QTY = 1e9;

const CLUSTER_MIN = 10;
const CLUSTER_MAX = 14;
const CLUSTER_STOP_THRESHOLD = 0.05;
const NOVELTY_AVOID = -0.45;
const NOVELTY_FRESH = 0.15;
const FITS_QTY_BONUS = 0.1;
const FITS_QTY_PENALTY = -0.2;

const GROCERY_QTY_WEIGHT = 0.65;
const GROCERY_SKU_WEIGHT = 0.35;
const PERISH_WEIGHT_GROCERY = 4;
const OVERLAP_WEIGHT_GROCERY = 4;
const PERISH_WEIGHT_KITCHEN = 8;
const OVERLAP_WEIGHT_KITCHEN = 4;

type Feasible = {
  recipe: Recipe;
  modified: boolean;
  swaps: { from: string; to: string }[];
  missing_optionals: string[];
};

type SortablePlan = GeneratedPlan & { _sort: number };

export function generateCandidatePlans(input: {
  recipes: Recipe[];
  recipeIngredients: RecipeIngredient[];
  ingredients: Ingredient[];
  pool: PoolItem[];
  purchased: PurchasedItem[];
  conversions: UnitConversion[];
  days?: number;
  mode?: GenerateMode;
}): GeneratedPlan[] {
  const { recipes, recipeIngredients, ingredients, pool, purchased, conversions } = input;
  const days = clampDays(input.days);
  const mode: GenerateMode = input.mode ?? "use-kitchen";
  const baseQtyMap = poolToQtyMap(pool, ingredients, conversions);
  const feasible: Feasible[] = [];

  for (const recipe of recipes) {
    const result = evaluateRecipe(recipe, recipeIngredients, pool, ingredients, conversions, baseQtyMap);
    if (mode === "grocery-list" || result.feasible) {
      feasible.push({
        recipe,
        modified: result.modified,
        swaps: result.swaps,
        missing_optionals: result.missing_optionals,
      });
    }
  }

  if (feasible.length === 0) return [];

  // In grocery-list mode, missing ingredients are buyable: seed the scheduling
  // qty map with a large sentinel for every required non-staple ingredient so
  // consumption never blocks. The real pool is still used to compute the grocery list.
  const schedulingQtyMap = mode === "grocery-list" ? seedSentinels(baseQtyMap, feasible, recipeIngredients, ingredients) : baseQtyMap;

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
      schedulingQtyMap,
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
    let extra = feasible.find((f) => !usedRecipes.has(f.recipe.recipe_id));
    if (!extra) extra = feasible[clusters.length];
    if (!extra) break;
    const cluster = growCluster(
      extra,
      feasible,
      overlap,
      recipeIngredients,
      ingredients,
      conversions,
      schedulingQtyMap,
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

  const plans: SortablePlan[] = clusters.slice(0, 3).map((cluster, index) => {
    const expanded = expandToDays(cluster, feasible, recipeIngredients, ingredients, conversions, schedulingQtyMap, days);
    const usage = usageBreakdown(expanded.slots, purchased, recipeIngredients, ingredients, conversions, cluster);
    const overlapScore = clusterOverlap(cluster, overlap);
    const perishScore = perishabilityScore(expanded.slots, recipeIngredients, ingredients, days);
    const skuCoverage = skuCoveragePct(usage);
    const qtyUtil = quantityUtilPct(usage);
    const grocery = Math.round((qtyUtil * GROCERY_QTY_WEIGHT + skuCoverage * GROCERY_SKU_WEIGHT) * 10) / 10;
    const groceryList =
      mode === "grocery-list"
        ? buildGroceryList(expanded.slots, recipeIngredients, ingredients, conversions, baseQtyMap)
        : [];
    // In grocery-list mode, fewer items to buy is better (and indirectly rewards
    // using on-hand ingredients). In use-kitchen mode, keep the existing haul score.
    const combined =
      mode === "grocery-list"
        ? -groceryList.length + perishScore * PERISH_WEIGHT_GROCERY + overlapScore * OVERLAP_WEIGHT_GROCERY
        : grocery + perishScore * PERISH_WEIGHT_KITCHEN + overlapScore * OVERLAP_WEIGHT_KITCHEN;
    return {
      plan_rank: index + 1,
      overlap_score: Math.round(overlapScore * 1000) / 1000,
      grocery_utilization_pct: grocery,
      summary_text: buildSummary(expanded.slots, cluster, purchased, recipeIngredients),
      days,
      slots: expanded.slots,
      usage,
      grocery_list: groceryList,
      _sort: combined,
    };
  });

  plans.sort((a, b) => b._sort - a._sort);
  return plans.map((plan, i) => ({
    plan_rank: i + 1,
    overlap_score: plan.overlap_score,
    grocery_utilization_pct: plan.grocery_utilization_pct,
    summary_text: plan.summary_text,
    days: plan.days,
    slots: plan.slots,
    usage: plan.usage,
    grocery_list: plan.grocery_list,
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
  const targetMin = Math.min(CLUSTER_MIN, feasible.length);
  const targetMax = Math.min(CLUSTER_MAX, feasible.length);

  while (cluster.length < targetMax) {
    let best: Feasible | null = null;
    let bestScore = -Infinity;
    for (const candidate of remaining) {
      const avg =
        cluster.reduce(
          (sum, c) => sum + (overlap.get(pairKey(c.recipe.recipe_id, candidate.recipe.recipe_id)) ?? 0),
          0,
        ) / cluster.length;
      const novelty = avoidIds.has(candidate.recipe.recipe_id) ? NOVELTY_AVOID : NOVELTY_FRESH;
      const fitsQty = clusterFitsQty([...cluster, candidate], rows, ingredients, conversions, qtyMap)
        ? FITS_QTY_BONUS
        : FITS_QTY_PENALTY;
      const score = avg + novelty + fitsQty;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (!best) break;
    cluster.push(best);
    remaining.splice(remaining.indexOf(best), 1);
    if (cluster.length >= targetMin && bestScore < CLUSTER_STOP_THRESHOLD) break;
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

function expandToDays(
  cluster: Feasible[],
  allFeasible: Feasible[],
  rows: RecipeIngredient[],
  ingredients: Ingredient[],
  conversions: UnitConversion[],
  qtyMap: Map<string, { qty: number; unit: string }>,
  days: number,
): { slots: PlanSlot[] } {
  const slots: PlanSlot[] = [];
  for (let day = 1; day <= days; day++) {
    slots.push(emptySlot(day, "lunch"));
    slots.push(emptySlot(day, "dinner"));
  }

  const working = cloneQtyMap(qtyMap);
  const cookedIds = () =>
    new Set(slots.filter((s) => s.recipe_id && !s.is_leftover).map((s) => s.recipe_id!));

  const perishOrder = (items: Feasible[]) =>
    [...items].sort((a, b) => {
      const pa = recipePerish(a.recipe.recipe_id, rows, ingredients);
      const pb = recipePerish(b.recipe.recipe_id, rows, ingredients);
      if (pb !== pa) return pb - pa;
      return b.recipe.prep_time_minutes - a.recipe.prep_time_minutes;
    });

  const clusterIds = new Set(cluster.map((c) => c.recipe.recipe_id));
  const distinctOrder = [
    ...perishOrder(cluster),
    ...perishOrder(allFeasible.filter((f) => !clusterIds.has(f.recipe.recipe_id))),
  ];
  for (const item of distinctOrder) {
    if (cookedIds().has(item.recipe.recipe_id)) continue;
    const preferred: "lunch" | "dinner" =
      item.recipe.prep_time_minutes >= PREP_DINNER_THRESHOLD ? "dinner" : "lunch";
    placeCook(slots, item, preferred, working, rows, ingredients, conversions, days);
  }

  for (const slot of slots) {
    if (slot.recipe_id) continue;
    const nextCook = pickNextCook(slots, cluster, allFeasible, working, rows, ingredients, conversions);
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
    const repeatCook = pickRepeatCook(slots, cluster, allFeasible);
    if (repeatCook) {
      assignSlot(slot, repeatCook, false);
    }
  }

  return { slots };
}

function pickRepeatCook(
  slots: PlanSlot[],
  cluster: Feasible[],
  allFeasible: Feasible[],
): Feasible | null {
  const cooked = slots.filter((s) => s.recipe_id && !s.is_leftover);
  if (cooked.length === 0) return null;
  const byId = new Map(allFeasible.map((f) => [f.recipe.recipe_id, f]));
  const usedInWeek = [...new Set(cooked.map((s) => s.recipe_id!))];
  const pools = [
    usedInWeek.map((id) => byId.get(id)).filter((f): f is Feasible => !!f),
    cluster,
    allFeasible,
  ];
  for (const pool of pools) {
    if (pool.length) return pool[cooked.length % pool.length];
  }
  return null;
}

function pickNextCook(
  slots: PlanSlot[],
  cluster: Feasible[],
  allFeasible: Feasible[],
  working: Map<string, { qty: number; unit: string }>,
  rows: RecipeIngredient[],
  ingredients: Ingredient[],
  conversions: UnitConversion[],
): Feasible | null {
  const cooked = new Set(
    slots.filter((s) => s.recipe_id && !s.is_leftover).map((s) => s.recipe_id!),
  );
  const pools = [
    allFeasible.filter((f) => !cooked.has(f.recipe.recipe_id)),
    cluster,
    allFeasible,
  ];
  for (const pool of pools) {
    for (const item of pool) {
      if (canCook(item.recipe.recipe_id, rows, working, ingredients, conversions, item.swaps)) {
        return item;
      }
    }
  }
  return null;
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
  days: number,
): boolean {
  const other = preferred === "dinner" ? "lunch" : "dinner";
  for (let day = 1; day <= days; day++) {
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
  days: number,
): number {
  const cooks = slots.filter((s) => s.recipe_id && !s.is_leftover);
  if (cooks.length === 0) return 0;
  const span = Math.max(1, days - 1);
  let sum = 0;
  for (const cook of cooks) {
    const perish = recipePerish(cook.recipe_id!, rows, ingredients);
    const early = 1 - (cook.day_number - 1) / span;
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

function clampDays(days: number | undefined): number {
  if (!days || Number.isNaN(days)) return 7;
  return Math.min(7, Math.max(1, Math.floor(days)));
}

function seedSentinels(
  qtyMap: QtyMap,
  feasible: Feasible[],
  rows: RecipeIngredient[],
  ingredients: Ingredient[],
): QtyMap {
  const byName = indexByName(ingredients);
  const seeded = cloneQtyMap(qtyMap);
  for (const f of feasible) {
    const needed = rows.filter((r) => r.recipe_id === f.recipe.recipe_id && !r.substitute_for);
    for (const row of needed) {
      const meta = byName.get(row.ingredient_name);
      if (row.tier === "staple" || meta?.is_staple) continue;
      seeded.set(row.ingredient_name, {
        qty: SENTINEL_QTY,
        unit: meta?.default_unit ?? row.unit,
      });
    }
  }
  return seeded;
}

function buildGroceryList(
  slots: PlanSlot[],
  rows: RecipeIngredient[],
  ingredients: Ingredient[],
  conversions: UnitConversion[],
  poolQtyMap: QtyMap,
): GroceryListRow[] {
  const byName = indexByName(ingredients);
  const available = cloneQtyMap(poolQtyMap);
  const needed = new Map<string, { qty: number; unit: string }>();

  const cooks = slots.filter((s) => s.recipe_id && !s.is_leftover);
  for (const slot of cooks) {
    const slotRows = rows.filter((r) => r.recipe_id === slot.recipe_id && !r.substitute_for);
    const swapTo = new Map(slot.swaps.map((s) => [s.from, s.to]));
    for (const row of slotRows) {
      const meta = byName.get(row.ingredient_name);
      if (row.tier === "staple" || meta?.is_staple) continue;
      const name = swapTo.get(row.ingredient_name) ?? row.ingredient_name;
      const useRow =
        name === row.ingredient_name
          ? row
          : rows.find((r) => r.recipe_id === slot.recipe_id && r.ingredient_name === name) ?? row;
      const useMeta = byName.get(name);
      const converted = toDefaultUnit(
        useRow.quantity,
        useRow.unit,
        useMeta?.default_unit ?? useRow.unit,
        conversions,
      );
      if (!converted.ok) continue;
      const have = available.get(name);
      const onHand = have ? Math.min(have.qty, converted.qty) : 0;
      if (have) have.qty = Math.max(0, have.qty - onHand);
      const shortfall = converted.qty - onHand;
      if (shortfall > 1e-9) {
        const prev = needed.get(name);
        needed.set(name, {
          qty: (prev?.qty ?? 0) + shortfall,
          unit: converted.unit,
        });
      }
    }
  }

  return [...needed.entries()]
    .map(([ingredient_name, { qty, unit }]) => ({
      ingredient_name,
      quantity: Math.round(qty * 10) / 10,
      unit,
    }))
    .sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name));
}
