import { readFileSync } from "node:fs";
import { parseBool, parseCsv, parseNumber } from "../lib/csv";
import { generateCandidatePlans } from "../lib/generate-plans";
import type { Ingredient, PoolItem, Recipe, RecipeIngredient, UnitConversion } from "../lib/types";

const ingredients: Ingredient[] = parseCsv(readFileSync("data/sample/ingredients.csv", "utf8")).map((row) => ({
  ingredient_name: row.ingredient_name,
  category: row.category,
  perishability: row.perishability as Ingredient["perishability"],
  default_unit: row.default_unit,
  aliases: row.aliases ?? "",
  is_staple: parseBool(row.is_staple),
}));

const recipes: Recipe[] = parseCsv(readFileSync("data/sample/recipes.csv", "utf8")).map((row) => ({
  recipe_id: row.recipe_id,
  recipe_name: row.recipe_name,
  servings: parseNumber(row.servings) || 1,
  prep_time_minutes: parseNumber(row.prep_time_minutes) || 0,
  cuisine_tag: row.cuisine_tag || null,
  instructions: row.instructions || null,
  notes: row.notes || null,
}));

const recipeIngredients: RecipeIngredient[] = parseCsv(
  readFileSync("data/sample/recipe_ingredients.csv", "utf8"),
).map((row) => ({
  recipe_id: row.recipe_id,
  ingredient_name: row.ingredient_name,
  quantity: parseNumber(row.quantity),
  unit: row.unit,
  tier: row.tier as RecipeIngredient["tier"],
  substitute_for: row.substitute_for || null,
}));

const conversions: UnitConversion[] = [
  { from_unit: "kg", to_unit: "g", multiplier: 1000 },
  { from_unit: "lb", to_unit: "g", multiplier: 453.592 },
];

const staples: PoolItem[] = ingredients
  .filter((i) => i.is_staple)
  .map((i) => ({
    ingredient_name: i.ingredient_name,
    quantity: 1,
    unit: i.default_unit,
    source: "staple" as const,
  }));

const purchased: PoolItem[] = [
  { ingredient_name: "chicken breast", quantity: 600, unit: "g", source: "receipt" },
  { ingredient_name: "salmon", quantity: 200, unit: "g", source: "receipt" },
  { ingredient_name: "spinach", quantity: 200, unit: "g", source: "receipt" },
  { ingredient_name: "broccoli", quantity: 400, unit: "g", source: "receipt" },
  { ingredient_name: "pasta", quantity: 400, unit: "g", source: "receipt" },
  { ingredient_name: "ground turkey", quantity: 400, unit: "g", source: "receipt" },
  { ingredient_name: "eggs", quantity: 6, unit: "unit", source: "receipt" },
  { ingredient_name: "canned tomatoes", quantity: 800, unit: "g", source: "receipt" },
  { ingredient_name: "rice", quantity: 300, unit: "g", source: "receipt" },
  { ingredient_name: "zucchini", quantity: 3, unit: "unit", source: "receipt" },
  { ingredient_name: "mixed greens", quantity: 200, unit: "g", source: "receipt" },
  { ingredient_name: "lemon", quantity: 4, unit: "unit", source: "receipt" },
  { ingredient_name: "chickpeas", quantity: 400, unit: "g", source: "receipt" },
  { ingredient_name: "greek yogurt", quantity: 200, unit: "g", source: "receipt" },
  { ingredient_name: "cabbage", quantity: 400, unit: "g", source: "receipt" },
  { ingredient_name: "tofu", quantity: 400, unit: "g", source: "receipt" },
  { ingredient_name: "canned tuna", quantity: 240, unit: "g", source: "receipt" },
];

const plans = generateCandidatePlans({
  recipes,
  recipeIngredients,
  ingredients,
  pool: [...staples, ...purchased],
  purchased: purchased.map(({ ingredient_name, quantity, unit }) => ({
    ingredient_name,
    quantity,
    unit,
  })),
  conversions,
});

console.log(
  plans.map((p) => ({
    rank: p.plan_rank,
    util: p.grocery_utilization_pct,
    summary: p.summary_text,
    filled: p.slots.filter((s) => s.recipe_id).length,
    cooks: p.slots.filter((s) => s.recipe_id && !s.is_leftover).length,
    leftovers: p.slots.filter((s) => s.is_leftover).length,
    recipes: [...new Set(p.slots.filter((s) => s.recipe_id && !s.is_leftover).map((s) => s.recipe_name))],
  })),
);
