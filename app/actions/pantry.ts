"use server";

import { revalidatePath } from "next/cache";
import { deletePantryItem, setPantryStatus } from "@/lib/pantry";
import type { PantryStatus } from "@/lib/types";

export async function markPantryStatus(pantryItemId: string, status: PantryStatus) {
  try {
    await setPantryStatus(pantryItemId, status);
    revalidatePath("/kitchen");
    revalidatePath("/groceries/confirm");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not update pantry" };
  }
}

export async function removePantryItem(pantryItemId: string) {
  try {
    await deletePantryItem(pantryItemId);
    revalidatePath("/kitchen");
    revalidatePath("/groceries/confirm");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not remove item" };
  }
}
