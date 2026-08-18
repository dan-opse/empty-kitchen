import { ensureStapleRows, indexByName, listIngredients } from "@/lib/catalog";
import { getSupabase } from "@/lib/supabase";
import type { DraftLine, Ingredient, Perishability } from "@/lib/types";

const MAX_ALIAS_LEN = 200;
const MIN_ALIAS_LEN = 3;
const SKIP_RAW = new Set(["added by hand", "added by user"]);

function splitAliases(aliases: string): string[] {
  return aliases
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

function normalizeAlias(raw: string): string | null {
  const trimmed = raw.trim().slice(0, MAX_ALIAS_LEN);
  if (trimmed.length < MIN_ALIAS_LEN) return null;
  if (SKIP_RAW.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

function mergeAlias(aliases: string, ingredientName: string, newAlias: string): string | null {
  const alias = normalizeAlias(newAlias);
  if (!alias) return null;
  if (alias.toLowerCase() === ingredientName.toLowerCase()) return null;

  const existing = splitAliases(aliases);
  const seen = new Set(existing.map((a) => a.toLowerCase()));
  if (seen.has(alias.toLowerCase())) return null;

  return [...existing, alias].join(",");
}

function inferCategory(name: string, raw: string): string {
  const hay = `${name} ${raw}`.toLowerCase();
  if (/sauce|paste|oil|vinegar|miso|gochujang|broth|stock|noodle|rice|flour|starch|dashi|kimchi|pickle/.test(hay)) {
    return "pantry";
  }
  if (/milk|yogurt|cheese|butter|egg|tofu/.test(hay)) {
    return "dairy";
  }
  if (/chicken|pork|beef|shrimp|fish|duck|salmon|turkey|sausage|crab|clam/.test(hay)) {
    return "protein";
  }
  if (/pepper|salt|spice|anise|gochugaru/.test(hay)) {
    return "spice";
  }
  return "produce";
}

function inferPerishability(category: string): Perishability {
  if (category === "pantry" || category === "spice") return "low";
  if (category === "protein" || category === "produce" || category === "dairy") return "high";
  return "medium";
}

/**
 * After the user confirms a receipt on Final check, remember receipt text as aliases
 * (and create ingredients they typed that are not already in the catalog).
 */
export async function learnFromConfirmedReceipt(lines: DraftLine[]): Promise<{
  aliasesAdded: number;
  ingredientsCreated: number;
}> {
  const ingredients = await listIngredients();
  const byName = indexByName(ingredients);
  const sb = getSupabase();
  let aliasesAdded = 0;
  let ingredientsCreated = 0;

  for (const line of lines) {
    const name = line.matched_ingredient_name.trim();
    const raw = line.raw_line_text.trim();
    if (!name || !raw) continue;

    const existing = byName.get(name);
    if (existing) {
      const merged = mergeAlias(existing.aliases, name, raw);
      if (!merged) continue;
      const { error } = await sb
        .from("ingredients")
        .update({ aliases: merged })
        .eq("ingredient_name", name);
      if (error) throw error;
      existing.aliases = merged;
      aliasesAdded += 1;
      continue;
    }

    const alias =
      raw.toLowerCase() === name.toLowerCase() ? "" : (normalizeAlias(raw) ?? "");
    const category = inferCategory(name, raw);
    const row = {
      ingredient_name: name,
      category,
      perishability: inferPerishability(category),
      default_unit: line.unit?.trim() || "unit",
      aliases: alias,
      is_staple: false,
    };
    const { error } = await sb.from("ingredients").upsert(row, { onConflict: "ingredient_name" });
    if (error) throw error;
    byName.set(name, row as Ingredient);
    ingredientsCreated += 1;
  }

  if (ingredientsCreated > 0) {
    await ensureStapleRows();
  }

  return { aliasesAdded, ingredientsCreated };
}
