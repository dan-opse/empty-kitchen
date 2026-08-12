import { getSupabase } from "@/lib/supabase";
import { newId } from "@/lib/dates";
import type {
  Ingredient,
  PantryItem,
  Recipe,
  RecipeIngredient,
  UnitConversion,
} from "@/lib/types";

export async function listIngredients(): Promise<Ingredient[]> {
  const { data, error } = await getSupabase()
    .from("ingredients")
    .select("*")
    .order("ingredient_name");
  if (error) throw error;
  return (data ?? []) as Ingredient[];
}

export async function listRecipes(): Promise<Recipe[]> {
  const { data, error } = await getSupabase().from("recipes").select("*").order("recipe_id");
  if (error) throw error;
  return (data ?? []) as Recipe[];
}

export async function listRecipeIngredients(): Promise<RecipeIngredient[]> {
  const { data, error } = await getSupabase().from("recipe_ingredients").select("*");
  if (error) throw error;
  return (data ?? []) as RecipeIngredient[];
}

export async function listConversions(): Promise<UnitConversion[]> {
  const { data, error } = await getSupabase().from("unit_conversions").select("*");
  if (error) throw error;
  return (data ?? []) as UnitConversion[];
}

export async function listPantry(): Promise<PantryItem[]> {
  const { data, error } = await getSupabase()
    .from("pantry_items")
    .select("*")
    .order("kind")
    .order("ingredient_name");
  if (error) throw error;
  return (data ?? []) as PantryItem[];
}

export async function ensureStapleRows(): Promise<void> {
  const ingredients = await listIngredients();
  const pantry = await listPantry();
  const existing = new Set(
    pantry.filter((p) => p.kind === "staple").map((p) => p.ingredient_name),
  );
  const missing = ingredients.filter((i) => i.is_staple && !existing.has(i.ingredient_name));
  if (missing.length === 0) return;
  const rows = missing.map((i) => ({
    pantry_item_id: newId("pan"),
    ingredient_name: i.ingredient_name,
    quantity: null,
    unit: i.default_unit,
    status: "in_stock",
    kind: "staple",
    updated_at: new Date().toISOString(),
  }));
  const { error } = await getSupabase().from("pantry_items").insert(rows);
  if (error) throw error;
}

export async function recipeCount(): Promise<number> {
  const { count, error } = await getSupabase()
    .from("recipes")
    .select("recipe_id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
