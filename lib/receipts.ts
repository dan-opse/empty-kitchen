import { getSupabase } from "@/lib/supabase";
import { newId, todayISO } from "@/lib/dates";
import { listIngredients } from "@/lib/catalog";
import { extractGroceryLines } from "@/lib/openai";
import type { DraftLine, ReceiptSource } from "@/lib/types";

export async function createReceiptFromCapture(input: {
  source: ReceiptSource;
  filename?: string;
  mime?: string;
  bytes?: Buffer;
  typedList?: string;
}): Promise<{ receiptId: string; items: DraftLine[]; raw_ocr_text: string }> {
  const sb = getSupabase();
  const receiptId = newId("rec");
  const ingredients = await listIngredients();
  if (ingredients.length === 0) {
    throw new Error("No ingredients imported yet. Import the sample CSV first.");
  }

  let storagePath: string | null = null;
  if (input.bytes && input.mime && input.source !== "manual") {
    storagePath = `${receiptId}/${input.filename ?? "receipt"}`;
    const { error: upErr } = await sb.storage.from("receipts").upload(storagePath, input.bytes, {
      contentType: input.mime,
      upsert: false,
    });
    if (upErr) throw upErr;
  }

  const extracted = await extractGroceryLines({
    ingredients,
    source: input.source,
    text: input.typedList,
    file:
      input.bytes && input.mime
        ? { bytes: input.bytes, mime: input.mime, filename: input.filename ?? "receipt" }
        : undefined,
  });

  const { error } = await sb.from("receipts").insert({
    receipt_id: receiptId,
    scan_date: todayISO(),
    source: input.source,
    original_filename: input.filename ?? null,
    mime_type: input.mime ?? null,
    storage_path: storagePath,
    raw_ocr_text: extracted.raw_ocr_text,
    file_deleted_at: null,
  });
  if (error) throw error;

  if (extracted.items.length) {
    const { error: itemErr } = await sb.from("receipt_items").insert(
      extracted.items.map((item) => ({
        receipt_id: receiptId,
        raw_line_text: item.raw_line_text,
        matched_ingredient_name: item.matched_ingredient_name || null,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        confirmed_by_user: false,
      })),
    );
    if (itemErr) throw itemErr;
  }

  return { receiptId, items: extracted.items, raw_ocr_text: extracted.raw_ocr_text };
}

export async function createReceiptFromPreset(items: DraftLine[], label: string): Promise<{ receiptId: string }> {
  const sb = getSupabase();
  const ingredients = await listIngredients();
  if (ingredients.length === 0) {
    throw new Error("No ingredients imported yet. Import the sample CSV first.");
  }
  const names = new Set(ingredients.map((i) => i.ingredient_name));
  const unknown = items.filter((i) => !names.has(i.matched_ingredient_name));
  if (unknown.length) {
    throw new Error(`Unknown ingredients in sample haul: ${unknown.map((i) => i.matched_ingredient_name).join(", ")}`);
  }

  const receiptId = newId("rec");
  const { error } = await sb.from("receipts").insert({
    receipt_id: receiptId,
    scan_date: todayISO(),
    source: "manual",
    original_filename: null,
    mime_type: null,
    storage_path: null,
    raw_ocr_text: label,
    file_deleted_at: null,
  });
  if (error) throw error;

  const { error: itemErr } = await sb.from("receipt_items").insert(
    items.map((item) => ({
      receipt_id: receiptId,
      raw_line_text: item.raw_line_text,
      matched_ingredient_name: item.matched_ingredient_name || null,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      confirmed_by_user: false,
    })),
  );
  if (itemErr) throw itemErr;
  return { receiptId };
}

export async function getReceiptDraft(receiptId: string): Promise<{
  receipt_id: string;
  items: DraftLine[];
}> {
  const { data, error } = await getSupabase()
    .from("receipt_items")
    .select("*")
    .eq("receipt_id", receiptId);
  if (error) throw error;
  return {
    receipt_id: receiptId,
    items: (data ?? []).map((row) => ({
      raw_line_text: row.raw_line_text,
      matched_ingredient_name: row.matched_ingredient_name ?? "",
      quantity: row.quantity == null ? null : Number(row.quantity),
      unit: row.unit ?? "unit",
      price: row.price == null ? null : Number(row.price),
      needs_review: !row.matched_ingredient_name,
    })),
  };
}

export async function replaceReceiptItems(receiptId: string, items: DraftLine[]): Promise<void> {
  const sb = getSupabase();
  const { error: delErr } = await sb.from("receipt_items").delete().eq("receipt_id", receiptId);
  if (delErr) throw delErr;
  if (items.length === 0) return;
  const { error } = await sb.from("receipt_items").insert(
    items.map((item) => ({
      receipt_id: receiptId,
      raw_line_text: item.raw_line_text,
      matched_ingredient_name: item.matched_ingredient_name || null,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      confirmed_by_user: true,
    })),
  );
  if (error) throw error;
}

export async function purgeExpiredReceiptFiles(): Promise<{ purged: number }> {
  const sb = getSupabase();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const { data, error } = await sb
    .from("receipts")
    .select("receipt_id, storage_path")
    .is("file_deleted_at", null)
    .not("storage_path", "is", null)
    .lte("scan_date", cutoffIso);
  if (error) throw error;

  let purged = 0;
  for (const row of data ?? []) {
    if (row.storage_path) {
      await sb.storage.from("receipts").remove([row.storage_path]);
    }
    const { error: upErr } = await sb
      .from("receipts")
      .update({
        storage_path: null,
        raw_ocr_text: null,
        file_deleted_at: new Date().toISOString(),
      })
      .eq("receipt_id", row.receipt_id);
    if (upErr) throw upErr;
    purged += 1;
  }
  return { purged };
}
