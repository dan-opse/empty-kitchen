"use server";

import { revalidatePath } from "next/cache";
import { persistGeneration } from "@/lib/plans";
import { createReceiptFromCapture, replaceReceiptItems } from "@/lib/receipts";
import { upsertLeftover } from "@/lib/pantry";
import type { DraftLine, ReceiptSource } from "@/lib/types";

export async function captureGroceries(formData: FormData) {
  try {
    const mode = String(formData.get("mode") ?? "manual") as ReceiptSource | "photo" | "library";
    const typed = String(formData.get("typed") ?? "").trim();
    const file = formData.get("file");

    let source: ReceiptSource = "manual";
    let bytes: Buffer | undefined;
    let mime: string | undefined;
    let filename: string | undefined;

    if (file instanceof File && file.size > 0) {
      const buf = Buffer.from(await file.arrayBuffer());
      bytes = buf;
      mime = file.type || "application/octet-stream";
      filename = file.name;
      source = mime.includes("pdf") ? "pdf" : "image";
    } else if (mode === "pdf") {
      source = "pdf";
    } else if (mode === "image" || mode === "photo" || mode === "library") {
      source = "image";
    }

    if (source !== "manual" && !bytes) {
      return { ok: false as const, error: "Choose a photo or PDF first." };
    }
    if (source === "manual" && !typed) {
      return { ok: false as const, error: "Type a short list, like chicken, spinach, milk." };
    }

    const result = await createReceiptFromCapture({
      source,
      filename,
      mime,
      bytes,
      typedList: typed || undefined,
    });
    revalidatePath("/groceries");
    return { ok: true as const, receiptId: result.receiptId };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not read that list" };
  }
}

export async function confirmAndGenerate(input: {
  receiptId: string;
  items: DraftLine[];
  pantry: { ingredient_name: string; quantity: number; unit: string; keep: boolean }[];
}) {
  try {
    for (const row of input.pantry) {
      await upsertLeftover({
        ingredient_name: row.ingredient_name,
        quantity: row.quantity,
        unit: row.unit,
        status: row.keep ? "in_stock" : "ran_out",
      });
    }

    const confirmed = input.items.filter((i) => i.matched_ingredient_name.trim());
    await replaceReceiptItems(input.receiptId, confirmed);

    const purchased = confirmed
      .filter((i) => i.quantity != null && i.quantity > 0)
      .map((i) => ({
        ingredient_name: i.matched_ingredient_name,
        quantity: i.quantity as number,
        unit: i.unit,
      }));

    const { generationId, planCount } = await persistGeneration({
      receiptId: input.receiptId,
      purchased,
    });

    revalidatePath("/");
    revalidatePath("/kitchen");
    return { ok: true as const, generationId, planCount };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not generate plans" };
  }
}
