"use server";

import { revalidatePath } from "next/cache";
import { importCatalogCsv, readSampleCsv } from "@/lib/import-catalog";

export async function importSampleCatalog() {
  try {
    const counts = await importCatalogCsv(readSampleCsv());
    revalidatePath("/");
    revalidatePath("/kitchen");
    revalidatePath("/import");
    return { ok: true as const, counts };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Import failed" };
  }
}

export async function importUploadedCsv(formData: FormData) {
  try {
    const ingredients = formData.get("ingredients");
    const recipes = formData.get("recipes");
    const recipeIngredients = formData.get("recipeIngredients");
    if (!(ingredients instanceof File) || !(recipes instanceof File) || !(recipeIngredients instanceof File)) {
      return { ok: false as const, error: "Upload all three CSV files." };
    }
    const counts = await importCatalogCsv({
      ingredientsCsv: await ingredients.text(),
      recipesCsv: await recipes.text(),
      recipeIngredientsCsv: await recipeIngredients.text(),
    });
    revalidatePath("/");
    revalidatePath("/kitchen");
    return { ok: true as const, counts };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Import failed" };
  }
}
