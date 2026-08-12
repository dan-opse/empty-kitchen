import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { importCatalogCsv, readSampleCsv } from "../lib/import-catalog";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const sample = process.argv.includes("--sample");
  const files = sample
    ? readSampleCsv()
    : {
        ingredientsCsv: readFileSync(argValue("--ingredients") ?? "data/sample/ingredients.csv", "utf8"),
        recipesCsv: readFileSync(argValue("--recipes") ?? "data/sample/recipes.csv", "utf8"),
        recipeIngredientsCsv: readFileSync(
          argValue("--recipe-ingredients") ?? "data/sample/recipe_ingredients.csv",
          "utf8",
        ),
      };
  const counts = await importCatalogCsv(files);
  console.log("Imported", counts);
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i >= 0) return process.argv[i + 1];
  return undefined;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
