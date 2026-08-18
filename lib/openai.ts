import OpenAI from "openai";
import { extractModel, openaiConfigured, summaryModel } from "@/lib/env";
import { guessIngredientName } from "@/lib/match-ingredient";
import type { DraftLine, Ingredient } from "@/lib/types";

function client(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const LINE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    raw_ocr_text: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          raw_line_text: { type: "string" },
          matched_ingredient_name: { type: ["string", "null"] },
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          price: { type: ["number", "null"] },
          needs_review: { type: "boolean" },
        },
        required: [
          "raw_line_text",
          "matched_ingredient_name",
          "quantity",
          "unit",
          "price",
          "needs_review",
        ],
      },
    },
  },
  required: ["raw_ocr_text", "items"],
} as const;

function catalogBlock(ingredients: Ingredient[]): string {
  return ingredients
    .map((i) => {
      const aliases = i.aliases ? ` aliases: ${i.aliases}` : "";
      return `- ${i.ingredient_name} | default_unit=${i.default_unit} | staple=${i.is_staple}${aliases}`;
    })
    .join("\n");
}

function systemPrompt(ingredients: Ingredient[]): string {
  return `You normalize grocery receipt lines or a short typed list into canonical kitchen ingredients.

Master list (match ONLY these names, using aliases when the receipt is abbreviated):
${catalogBlock(ingredients)}

Rules:
- Skip tax, total, store name, payment, bottle deposit, and non-food junk.
- Convert quantity into the ingredient default_unit when units are compatible (weight family or volume family). Never convert weight to volume.
- Count units (unit, bunch, clove) stay count. If unsure, set needs_review true.
- If the receipt has no quantity, guess a reasonable household amount and set needs_review true.
- Price is the line price if present, else null.
- matched_ingredient_name must be an exact master-list name, or null if nothing fits.
- For a typed list like "chicken, spinach, milk", expand each token into a guessed canonical ingredient with quantity and unit.`;
}

export async function extractGroceryLines(input: {
  ingredients: Ingredient[];
  source: "image" | "pdf" | "manual";
  text?: string;
  file?: { bytes: Buffer; mime: string; filename: string };
}): Promise<{ raw_ocr_text: string; items: DraftLine[] }> {
  if (!openaiConfigured()) {
    return fallbackExtract(input);
  }

  const openai = client();
  const content: OpenAI.Responses.ResponseInputContent[] = [
    {
      type: "input_text",
      text:
        input.source === "manual"
          ? `Typed list:\n${input.text ?? ""}`
          : "Extract grocery line items from this receipt. Read every page if it is a PDF.",
    },
  ];

  if (input.file && input.source === "image") {
    const b64 = input.file.bytes.toString("base64");
    content.push({
      type: "input_image",
      detail: "high",
      image_url: `data:${input.file.mime};base64,${b64}`,
    });
  } else if (input.file && input.source === "pdf") {
    content.push({
      type: "input_file",
      filename: input.file.filename,
      file_data: `data:application/pdf;base64,${input.file.bytes.toString("base64")}`,
    });
  }

  const response = await openai.responses.create({
    model: extractModel(),
    input: [{ role: "user", content }],
    instructions: systemPrompt(input.ingredients),
    text: {
      format: {
        type: "json_schema",
        name: "receipt_lines",
        strict: true,
        schema: LINE_SCHEMA,
      },
    },
  });

  let parsed: {
    raw_ocr_text?: string;
    items?: {
      raw_line_text: string;
      matched_ingredient_name: string | null;
      quantity: number | null;
      unit: string | null;
      price: number | null;
      needs_review: boolean;
    }[];
  };
  try {
    parsed = JSON.parse(response.output_text || "{}");
  } catch (error) {
    console.error("[openai] extractGroceryLines JSON.parse failed:", error);
    parsed = {};
  }

  const names = new Set(input.ingredients.map((i) => i.ingredient_name));
  const items: DraftLine[] = (parsed.items ?? [])
    .map((item) => {
      const name = item.matched_ingredient_name;
      const matched = name && names.has(name) ? name : guessIngredientName(item.raw_line_text, input.ingredients);
      return {
        raw_line_text: item.raw_line_text,
        matched_ingredient_name: matched ?? "",
        quantity: item.quantity,
        unit: item.unit ?? "unit",
        price: item.price,
        needs_review: item.needs_review || !matched,
      };
    })
    .filter((item) => item.raw_line_text.trim().length > 0);

  return {
    raw_ocr_text: parsed.raw_ocr_text || input.text || "",
    items,
  };
}

export async function polishSummary(draft: string): Promise<string> {
  if (!openaiConfigured() || !draft) return draft;
  try {
    const openai = client();
    const response = await openai.responses.create({
      model: summaryModel(),
      input: `Rewrite this meal-plan theme as one short plain-language sentence. Keep the facts, no marketing:\n${draft}`,
    });
    const text = response.output_text?.trim();
    return text || draft;
  } catch {
    return draft;
  }
}

function fallbackExtract(input: {
  ingredients: Ingredient[];
  source: "image" | "pdf" | "manual";
  text?: string;
}): { raw_ocr_text: string; items: DraftLine[] } {
  const text = input.text ?? "";
  const tokens = text
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const items: DraftLine[] = tokens.map((token) => {
    const matched = guessIngredientName(token, input.ingredients);
    const ing = input.ingredients.find((i) => i.ingredient_name === matched);
    return {
      raw_line_text: token,
      matched_ingredient_name: matched ?? "",
      quantity: matched ? 1 : null,
      unit: ing?.default_unit ?? "unit",
      price: null,
      needs_review: true,
    };
  });
  return { raw_ocr_text: text, items };
}
