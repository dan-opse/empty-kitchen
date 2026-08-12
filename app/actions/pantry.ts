"use server";

import { revalidatePath } from "next/cache";
import { setPantryStatus, updatePantryQty } from "@/lib/pantry";
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

export async function savePantryQty(pantryItemId: string, quantity: number | null, unit: string | null) {
  try {
    await updatePantryQty(pantryItemId, quantity, unit);
    revalidatePath("/kitchen");
    revalidatePath("/groceries/confirm");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not save quantity" };
  }
}
