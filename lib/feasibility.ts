import type {
  Ingredient,
  PoolItem,
  Recipe,
  RecipeIngredient,
  UnitConversion,
} from "@/lib/types";
import { toDefaultUnit } from "@/lib/units";

export type FeasibilityResult = {
  recipe_id: string;
  feasible: boolean;
  modified: boolean;
  swaps: { from: string; to: string }[];
  missing_required: string[];
  missing_optionals: string[];
};

type QtyMap = Map<string, { qty: number; unit: string }>;

export function poolToQtyMap(
  pool: PoolItem[],
  ingredients: Ingredient[],
  conversions: UnitConversion[],
): QtyMap {
  const byName = new Map(ingredients.map((i) => [i.ingredient_name, i]));
  const map: QtyMap = new Map();
  for (const item of pool) {
    const meta = byName.get(item.ingredient_name);
    const defaultUnit = meta?.default_unit ?? item.unit;
    const converted = toDefaultUnit(item.quantity, item.unit, defaultUnit, conversions);
    const prev = map.get(item.ingredient_name);
    if (prev && converted.ok) {
      map.set(item.ingredient_name, { qty: prev.qty + converted.qty, unit: converted.unit });
    } else if (!prev) {
      map.set(item.ingredient_name, {
        qty: converted.ok ? converted.qty : item.quantity,
        unit: converted.ok ? converted.unit : item.unit,
      });
    }
  }
  return map;
}

export function cloneQtyMap(map: QtyMap): QtyMap {
  return new Map([...map.entries()].map(([k, v]) => [k, { ...v }]));
}

export function hasStaple(pool: PoolItem[], name: string): boolean {
  return pool.some((p) => p.ingredient_name === name && p.source === "staple");
}

export function evaluateRecipe(
  recipe: Recipe,
  rows: RecipeIngredient[],
  pool: PoolItem[],
  ingredients: Ingredient[],
  conversions: UnitConversion[],
  qtyMap: QtyMap = poolToQtyMap(pool, ingredients, conversions),
): FeasibilityResult {
  const byName = new Map(ingredients.map((i) => [i.ingredient_name, i]));
  const swaps: { from: string; to: string }[] = [];
  const missing_required: string[] = [];
  const missing_optionals: string[] = [];
  let modified = false;

  const needed = rows.filter((r) => r.recipe_id === recipe.recipe_id);
  const substitutes = needed.filter((r) => r.substitute_for);

  for (const row of needed) {
    if (row.substitute_for) continue;
    const meta = byName.get(row.ingredient_name);
    const isStaple = row.tier === "staple" || Boolean(meta?.is_staple);

    if (isStaple) {
      if (!hasStaple(pool, row.ingredient_name) && !qtyMap.has(row.ingredient_name)) {
        if (row.tier === "required") missing_required.push(row.ingredient_name);
        else if (row.tier === "optional") {
          missing_optionals.push(row.ingredient_name);
          modified = true;
        }
      }
      continue;
    }

    const available = availableQty(row, qtyMap, byName, conversions);
    if (available.enough) {
      const swap = preferOnHandSwap(row, substitutes, pool, qtyMap, byName, conversions);
      if (swap) swaps.push(swap);
      continue;
    }

    const sub = findSubstitute(row.ingredient_name, substitutes, qtyMap, byName, conversions, pool);
    if (sub) {
      swaps.push({ from: row.ingredient_name, to: sub.ingredient_name });
      continue;
    }

    if (row.tier === "optional") {
      missing_optionals.push(row.ingredient_name);
      modified = true;
      continue;
    }

    missing_required.push(row.ingredient_name);
  }

  return {
    recipe_id: recipe.recipe_id,
    feasible: missing_required.length === 0,
    modified,
    swaps,
    missing_required,
    missing_optionals,
  };
}

function availableQty(
  row: RecipeIngredient,
  qtyMap: QtyMap,
  byName: Map<string, Ingredient>,
  conversions: UnitConversion[],
): { enough: boolean; have: number } {
  const have = qtyMap.get(row.ingredient_name);
  if (!have) return { enough: false, have: 0 };
  const meta = byName.get(row.ingredient_name);
  const need = toDefaultUnit(row.quantity, row.unit, meta?.default_unit ?? row.unit, conversions);
  if (!need.ok) return { enough: have.qty > 0, have: have.qty };
  return { enough: have.qty + 1e-9 >= need.qty, have: have.qty };
}

function findSubstitute(
  primary: string,
  substitutes: RecipeIngredient[],
  qtyMap: QtyMap,
  byName: Map<string, Ingredient>,
  conversions: UnitConversion[],
  pool: PoolItem[],
): RecipeIngredient | null {
  const candidates = substitutes.filter((s) => s.substitute_for === primary);
  const scored = candidates
    .map((s) => {
      const check = availableQty(s, qtyMap, byName, conversions);
      const onHand = pool.some(
        (p) => p.ingredient_name === s.ingredient_name && (p.source === "staple" || p.source === "pantry"),
      );
      return { s, check, onHand };
    })
    .filter((c) => c.check.enough);
  scored.sort((a, b) => Number(b.onHand) - Number(a.onHand));
  return scored[0]?.s ?? null;
}

function preferOnHandSwap(
  row: RecipeIngredient,
  substitutes: RecipeIngredient[],
  pool: PoolItem[],
  qtyMap: QtyMap,
  byName: Map<string, Ingredient>,
  conversions: UnitConversion[],
): { from: string; to: string } | null {
  const primaryOnHand = pool.some(
    (p) => p.ingredient_name === row.ingredient_name && (p.source === "staple" || p.source === "pantry"),
  );
  if (primaryOnHand) return null;
  const sub = findSubstitute(row.ingredient_name, substitutes, qtyMap, byName, conversions, pool);
  if (!sub) return null;
  const subOnHand = pool.some(
    (p) => p.ingredient_name === sub.ingredient_name && (p.source === "staple" || p.source === "pantry"),
  );
  if (subOnHand) return { from: row.ingredient_name, to: sub.ingredient_name };
  return null;
}

export function consumeCook(
  recipeId: string,
  rows: RecipeIngredient[],
  qtyMap: QtyMap,
  ingredients: Ingredient[],
  conversions: UnitConversion[],
  swaps: { from: string; to: string }[],
): boolean {
  const byName = new Map(ingredients.map((i) => [i.ingredient_name, i]));
  const needed = rows.filter((r) => r.recipe_id === recipeId && !r.substitute_for);
  const swapTo = new Map(swaps.map((s) => [s.from, s.to]));

  for (const row of needed) {
    const meta = byName.get(row.ingredient_name);
    if (row.tier === "staple" || meta?.is_staple) continue;
    const name = swapTo.get(row.ingredient_name) ?? row.ingredient_name;
    const useRow =
      name === row.ingredient_name
        ? row
        : rows.find((r) => r.recipe_id === recipeId && r.ingredient_name === name) ?? row;
    const useMeta = byName.get(name);
    const need = toDefaultUnit(
      useRow.quantity,
      useRow.unit,
      useMeta?.default_unit ?? useRow.unit,
      conversions,
    );
    if (!need.ok) continue;
    const have = qtyMap.get(name);
    if (!have || have.qty + 1e-9 < need.qty) return false;
  }

  for (const row of needed) {
    const meta = byName.get(row.ingredient_name);
    if (row.tier === "staple" || meta?.is_staple) continue;
    const name = swapTo.get(row.ingredient_name) ?? row.ingredient_name;
    const useRow =
      name === row.ingredient_name
        ? row
        : rows.find((r) => r.recipe_id === recipeId && r.ingredient_name === name) ?? row;
    const useMeta = byName.get(name);
    const need = toDefaultUnit(
      useRow.quantity,
      useRow.unit,
      useMeta?.default_unit ?? useRow.unit,
      conversions,
    );
    if (!need.ok) continue;
    const have = qtyMap.get(name)!;
    have.qty -= need.qty;
  }
  return true;
}

export function canCook(
  recipeId: string,
  rows: RecipeIngredient[],
  qtyMap: QtyMap,
  ingredients: Ingredient[],
  conversions: UnitConversion[],
  swaps: { from: string; to: string }[],
): boolean {
  const copy = cloneQtyMap(qtyMap);
  return consumeCook(recipeId, rows, copy, ingredients, conversions, swaps);
}
