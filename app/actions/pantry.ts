"use server";

import { revalidatePath } from "next/cache";
import { deletePantryItem, removePantryItems, setPantryNotes, setPantryStatus } from "@/lib/pantry";
import type { PantryStatus } from "@/lib/types";

function kitchenRevalidate() {
  revalidatePath("/kitchen");
  revalidatePath("/groceries/confirm");
}

export async function markPantryStatus(pantryItemId: string, status: PantryStatus) {
  try {
    await setPantryStatus(pantryItemId, status);
    kitchenRevalidate();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not update pantry" };
  }
}

export async function removePantryItem(pantryItemId: string) {
  try {
    await deletePantryItem(pantryItemId);
    kitchenRevalidate();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not remove item" };
  }
}

export async function removePantryItemsAction(ids: string[]) {
  try {
    await removePantryItems(ids);
    kitchenRevalidate();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not remove items" };
  }
}

export async function savePantryNotes(pantryItemId: string, notes: string) {
  try {
    await setPantryNotes(pantryItemId, notes);
    kitchenRevalidate();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not save note" };
  }
}
