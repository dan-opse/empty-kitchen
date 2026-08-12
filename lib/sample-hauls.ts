import type { DraftLine } from "@/lib/types";

export type SampleHaulId = "works" | "fails";

export type SampleHaul = {
  id: SampleHaulId;
  label: string;
  hint: string;
  items: DraftLine[];
};

function line(
  name: string,
  quantity: number,
  unit: string,
): DraftLine {
  return {
    raw_line_text: `${quantity} ${unit} ${name}`,
    matched_ingredient_name: name,
    quantity,
    unit,
    price: null,
    needs_review: false,
  };
}

/** Completes several sample recipes (chicken, fish, pasta, eggs, pantry). */
export const WORKING_HAUL: SampleHaul = {
  id: "works",
  label: "Test haul that works",
  hint: "A full Sunday shop against the sample recipes. Should return 3 plans.",
  items: [
    line("chicken breast", 600, "g"),
    line("salmon", 200, "g"),
    line("ground turkey", 400, "g"),
    line("eggs", 6, "unit"),
    line("tofu", 400, "g"),
    line("canned tuna", 240, "g"),
    line("chickpeas", 400, "g"),
    line("spinach", 200, "g"),
    line("broccoli", 400, "g"),
    line("zucchini", 3, "unit"),
    line("lemon", 4, "unit"),
    line("mixed greens", 200, "g"),
    line("cabbage", 400, "g"),
    line("pasta", 400, "g"),
    line("rice", 300, "g"),
    line("canned tomatoes", 800, "g"),
    line("greek yogurt", 200, "g"),
  ],
};

/** Catalog names, but no sample recipe has all of its required items. */
export const FAILING_HAUL: SampleHaul = {
  id: "fails",
  label: "Test haul that fails",
  hint: "Milk and bananas only. Nothing in the sample set can be cooked from this.",
  items: [
    line("banana", 6, "unit"),
    line("milk", 1000, "ml"),
  ],
};

export const SAMPLE_HAULS: SampleHaul[] = [WORKING_HAUL, FAILING_HAUL];

export function getSampleHaul(id: SampleHaulId): SampleHaul {
  const haul = SAMPLE_HAULS.find((h) => h.id === id);
  if (!haul) throw new Error(`Unknown sample haul: ${id}`);
  return haul;
}
