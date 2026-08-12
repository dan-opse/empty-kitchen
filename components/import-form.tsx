"use client";

import { useState, useTransition } from "react";
import { importSampleCatalog, importUploadedCsv } from "@/app/actions/import";
import { Spinner } from "@/components/spinner";

export function ImportForm() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[640px]">
      <h1 className="fade-up font-display text-[2.15rem] font-semibold leading-none tracking-tight">Import recipes</h1>
      <p className="mt-3 text-muted">
        Google Sheets is authoring-only. Export three CSVs and upsert them here. The app never writes back to Sheets.
      </p>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await importSampleCatalog();
            if (!result.ok) setError(result.error);
            else setMessage(`Loaded ${result.counts.recipes} sample recipes.`);
          })
        }
        className="pressable mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-teal py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? <Spinner /> : null}
        Load sample recipes
      </button>

      <form
        className="mt-8 space-y-3 rounded-[24px] bg-card p-4 shadow-[var(--shadow)]"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          start(async () => {
            setError(null);
            const result = await importUploadedCsv(data);
            if (!result.ok) setError(result.error);
            else setMessage(`Imported ${result.counts.recipes} recipes and ${result.counts.ingredients} ingredients.`);
          });
        }}
      >
        <label className="block text-sm font-semibold">
          ingredients.csv
          <input name="ingredients" type="file" accept=".csv" required className="mt-1 block w-full" />
        </label>
        <label className="block text-sm font-semibold">
          recipes.csv
          <input name="recipes" type="file" accept=".csv" required className="mt-1 block w-full" />
        </label>
        <label className="block text-sm font-semibold">
          recipe_ingredients.csv
          <input name="recipeIngredients" type="file" accept=".csv" required className="mt-1 block w-full" />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="pressable flex w-full items-center justify-center gap-2 rounded-full bg-teal-soft py-3 font-semibold text-teal disabled:opacity-60"
        >
          {pending ? <Spinner /> : null}
          Import CSVs
        </button>
      </form>

      {message ? <p className="fade-up mt-4 font-semibold text-teal">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-coral-text">{error}</p> : null}
    </div>
  );
}
