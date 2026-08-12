import { readFileSync } from "node:fs";
import { parseBool, parseCsv, parseNumber } from "@/lib/csv";
import { getSupabase } from "@/lib/supabase";
import { ensureStapleRows } from "@/lib/catalog";

export async function importCatalogCsv(input: {
  ingredientsCsv: string;
  recipesCsv: string;
  recipeIngredientsCsv: string;
}): Promise<{ ingredients: number; recipes: number; recipeIngredients: number }> {
  const sb = getSupabase();
  const ingredients = parseCsv(input.ingredientsCsv).map((row) => ({
    ingredient_name: row.ingredient_name,
    category: row.category,
    perishability: row.perishability,
    default_unit: row.default_unit,
    aliases: row.aliases ?? "",
    is_staple: parseBool(row.is_staple),
  }));
  const recipes = parseCsv(input.recipesCsv).map((row) => ({
    recipe_id: row.recipe_id,
    recipe_name: row.recipe_name,
    servings: parseNumber(row.servings) || 1,
    prep_time_minutes: parseNumber(row.prep_time_minutes) || 0,
    cuisine_tag: row.cuisine_tag || null,
    instructions: row.instructions || null,
    notes: row.notes || null,
  }));
  const recipeIngredients = parseCsv(input.recipeIngredientsCsv).map((row) => ({
    recipe_id: row.recipe_id,
    ingredient_name: row.ingredient_name,
    quantity: parseNumber(row.quantity),
    unit: row.unit,
    tier: row.tier,
    substitute_for: row.substitute_for || null,
  }));

  if (ingredients.length) {
    const { error } = await sb.from("ingredients").upsert(ingredients, { onConflict: "ingredient_name" });
    if (error) throw error;
  }
  if (recipes.length) {
    const { error } = await sb.from("recipes").upsert(recipes, { onConflict: "recipe_id" });
    if (error) throw error;
  }
  if (recipeIngredients.length) {
    await sb.from("recipe_ingredients").delete().in(
      "recipe_id",
      [...new Set(recipeIngredients.map((r) => r.recipe_id))],
    );
    const { error } = await sb.from("recipe_ingredients").insert(recipeIngredients);
    if (error) throw error;
  }

  await ensureStapleRows();
  return {
    ingredients: ingredients.length,
    recipes: recipes.length,
    recipeIngredients: recipeIngredients.length,
  };
}

export function readSampleCsv() {
  return {
    ingredientsCsv: readFileSync("data/sample/ingredients.csv", "utf8"),
    recipesCsv: readFileSync("data/sample/recipes.csv", "utf8"),
    recipeIngredientsCsv: readFileSync("data/sample/recipe_ingredients.csv", "utf8"),
  };
}
