import type { UnitConversion } from "@/lib/types";

const WEIGHT = new Set(["g", "kg", "lb", "oz"]);
const VOLUME = new Set(["ml", "l", "cup", "tbsp", "tsp", "gal", "fl oz", "floz"]);

const ALIASES: Record<string, string> = {
  gram: "g",
  grams: "g",
  kilogram: "kg",
  kilograms: "kg",
  pound: "lb",
  pounds: "lb",
  lbs: "lb",
  ounce: "oz",
  ounces: "oz",
  milliliter: "ml",
  millilitre: "ml",
  milliliters: "ml",
  liter: "l",
  litre: "l",
  liters: "l",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  gallon: "gal",
  gallons: "gal",
  "fl. oz": "fl oz",
  floz: "fl oz",
  "fluid ounce": "fl oz",
  "fluid ounces": "fl oz",
  cups: "cup",
  count: "unit",
  each: "unit",
  ea: "unit",
  pcs: "unit",
  pc: "unit",
  piece: "unit",
  pieces: "unit",
  cloves: "clove",
  bunches: "bunch",
};

export function normalizeUnit(unit: string | null | undefined): string {
  if (!unit) return "unit";
  const key = unit.trim().toLowerCase();
  return ALIASES[key] ?? key;
}

export function unitFamily(unit: string): "weight" | "volume" | "count" {
  const u = normalizeUnit(unit);
  if (WEIGHT.has(u)) return "weight";
  if (VOLUME.has(u)) return "volume";
  return "count";
}

export function unitsCompatible(from: string, to: string): boolean {
  const a = normalizeUnit(from);
  const b = normalizeUnit(to);
  if (a === b) return true;
  const fa = unitFamily(a);
  const fb = unitFamily(b);
  if (fa === "count" || fb === "count") return a === b;
  return fa === fb;
}

function lookupMultiplier(
  conversions: UnitConversion[],
  from: string,
  to: string,
): number | null {
  const a = normalizeUnit(from);
  const b = normalizeUnit(to);
  if (a === b) return 1;
  const direct = conversions.find(
    (row) => normalizeUnit(row.from_unit) === a && normalizeUnit(row.to_unit) === b,
  );
  if (direct) return direct.multiplier;
  const reverse = conversions.find(
    (row) => normalizeUnit(row.from_unit) === b && normalizeUnit(row.to_unit) === a,
  );
  if (reverse && reverse.multiplier !== 0) return 1 / reverse.multiplier;
  return null;
}

function convertQuantity(
  qty: number,
  fromUnit: string,
  toUnit: string,
  conversions: UnitConversion[],
): number | null {
  const multiplier = lookupMultiplier(conversions, fromUnit, toUnit);
  if (multiplier == null) return null;
  return qty * multiplier;
}

export function toDefaultUnit(
  qty: number,
  fromUnit: string,
  defaultUnit: string,
  conversions: UnitConversion[],
): { qty: number; unit: string; ok: boolean } {
  if (!unitsCompatible(fromUnit, defaultUnit)) {
    return { qty, unit: normalizeUnit(fromUnit), ok: false };
  }
  const converted = convertQuantity(qty, fromUnit, defaultUnit, conversions);
  if (converted == null) {
    return { qty, unit: normalizeUnit(fromUnit), ok: false };
  }
  return { qty: converted, unit: normalizeUnit(defaultUnit), ok: true };
}
