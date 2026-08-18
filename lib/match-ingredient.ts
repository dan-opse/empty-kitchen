import type { Ingredient } from "@/lib/types";

const MIN_TERM_LENGTH = 3;

/**
 * Best-effort substring match against catalog names and aliases.
 * Prefers the longest matching term so "chicken broth" wins over "chicken".
 */
export function guessIngredientName(raw: string, ingredients: Ingredient[]): string | null {
  const hay = raw.toLowerCase();
  let best: { name: string; len: number } | null = null;

  for (const ing of ingredients) {
    const terms = [ing.ingredient_name, ...ing.aliases.split(",").map((a) => a.trim()).filter(Boolean)];
    for (const term of terms) {
      const t = term.toLowerCase();
      if (t.length < MIN_TERM_LENGTH) continue;
      if (!hay.includes(t)) continue;
      if (!best || t.length > best.len) {
        best = { name: ing.ingredient_name, len: t.length };
      }
    }
  }

  return best?.name ?? null;
}
