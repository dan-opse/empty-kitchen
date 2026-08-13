import { getSupabase } from "@/lib/supabase";
import { newId } from "@/lib/dates";
import type { PantryItem, PantryStatus, PoolItem } from "@/lib/types";
import { listIngredients, listPantry } from "@/lib/catalog";

export async function setPantryStatus(pantryItemId: string, status: PantryStatus): Promise<void> {
  const { error } = await getSupabase()
    .from("pantry_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("pantry_item_id", pantryItemId);
  if (error) throw error;
}

export async function upsertLeftover(input: {
  ingredient_name: string;
  quantity: number;
  unit: string;
  status: PantryStatus;
}): Promise<void> {
  const pantry = await listPantry();
  const existing = pantry.find(
    (p) => p.kind === "leftover" && p.ingredient_name === input.ingredient_name,
  );
  if (existing) {
    const { error } = await getSupabase()
      .from("pantry_items")
      .update({
        quantity: input.quantity,
        unit: input.unit,
        status: input.status,
        updated_at: new Date().toISOString(),
      })
      .eq("pantry_item_id", existing.pantry_item_id);
    if (error) throw error;
    return;
  }
  const { error } = await getSupabase().from("pantry_items").insert({
    pantry_item_id: newId("pan"),
    ingredient_name: input.ingredient_name,
    quantity: input.quantity,
    unit: input.unit,
    status: input.status,
    kind: "leftover",
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deletePantryItem(pantryItemId: string): Promise<void> {
  await removePantryItems([pantryItemId]);
}

export async function removePantryItems(ids: string[]): Promise<void> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("pantry_items")
    .select("pantry_item_id, kind")
    .in("pantry_item_id", unique);
  if (error) throw error;

  const leftoverIds = (data ?? []).filter((row) => row.kind === "leftover").map((row) => row.pantry_item_id);
  const stapleIds = (data ?? []).filter((row) => row.kind === "staple").map((row) => row.pantry_item_id);

  if (leftoverIds.length) {
    const { error: delErr } = await sb.from("pantry_items").delete().in("pantry_item_id", leftoverIds);
    if (delErr) throw delErr;
  }
  if (stapleIds.length) {
    const { error: hideErr } = await sb
      .from("pantry_items")
      .update({ hidden: true, status: "ran_out", updated_at: new Date().toISOString() })
      .in("pantry_item_id", stapleIds);
    if (hideErr) throw hideErr;
  }
}

export async function setPantryNotes(pantryItemId: string, notes: string): Promise<void> {
  const { error } = await getSupabase()
    .from("pantry_items")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("pantry_item_id", pantryItemId);
  if (error) throw error;
}

export async function restockStaple(ingredientName: string): Promise<void> {
  const { error } = await getSupabase()
    .from("pantry_items")
    .update({ status: "in_stock", hidden: false, updated_at: new Date().toISOString() })
    .eq("kind", "staple")
    .eq("ingredient_name", ingredientName);
  if (error) throw error;
}

export async function buildPool(extra?: {
  ingredient_name: string;
  quantity: number;
  unit: string;
}[]): Promise<PoolItem[]> {
  const pantry = await listPantry();
  const ingredients = await listIngredients();
  const stapleNames = new Set(ingredients.filter((i) => i.is_staple).map((i) => i.ingredient_name));
  const pool: PoolItem[] = [];

  for (const item of pantry) {
    if (item.status !== "in_stock") continue;
    if (item.kind === "staple") {
      pool.push({
        ingredient_name: item.ingredient_name,
        quantity: item.quantity ?? 1,
        unit: item.unit ?? "unit",
        source: "staple",
      });
    } else {
      pool.push({
        ingredient_name: item.ingredient_name,
        quantity: item.quantity ?? 0,
        unit: item.unit ?? "unit",
        source: "pantry",
      });
    }
  }

  for (const item of extra ?? []) {
    pool.push({
      ingredient_name: item.ingredient_name,
      quantity: item.quantity,
      unit: item.unit,
      source: "receipt",
    });
    if (stapleNames.has(item.ingredient_name)) {
      await restockStaple(item.ingredient_name);
    }
  }

  return pool;
}

export function splitPantry(items: PantryItem[]): {
  leftovers: PantryItem[];
  staples: PantryItem[];
} {
  return {
    leftovers: items.filter((i) => i.kind === "leftover"),
    staples: items.filter((i) => i.kind === "staple"),
  };
}
