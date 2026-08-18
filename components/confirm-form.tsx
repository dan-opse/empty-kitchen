"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmAndGenerate } from "@/app/actions/groceries";
import { Spinner } from "@/components/spinner";
import type { DraftLine, Ingredient, PantryItem } from "@/lib/types";

type PantryDraft = {
  ingredient_name: string;
  quantity: number;
  unit: string;
  keep: boolean;
};

export function ConfirmForm({
  receiptId,
  items: initialItems,
  pantry,
  ingredients,
}: {
  receiptId: string;
  items: DraftLine[];
  pantry: PantryItem[];
  ingredients: Ingredient[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DraftLine[]>(
    initialItems.length ? initialItems : [blankLine()],
  );
  const [kitchen, setKitchen] = useState<PantryDraft[]>(
    pantry
      .filter((p) => p.kind === "leftover" && p.status === "in_stock")
      .map((p) => ({
        ingredient_name: p.ingredient_name,
        quantity: p.quantity ?? 0,
        unit: p.unit ?? "unit",
        keep: true,
      })),
  );

  function updateItem(index: number, patch: Partial<DraftLine>) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const reviewCount = items.filter((item) => item.needs_review).length;

  return (
    <div className="mx-auto max-w-[640px]">
      <h1 className="fade-up font-display text-[2.15rem] font-semibold leading-none tracking-tight">Final check</h1>
      <p className="mt-3 text-muted">
        Fix names, quantities, and units before matching. When you generate, receipt line text is saved as
        aliases so the next scan matches faster.
      </p>

      {kitchen.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-label">Already in kitchen</h2>
          <ul className="space-y-2">
            {kitchen.map((row, i) => (
              <li key={row.ingredient_name} className="rounded-[20px] bg-card p-3 shadow-[var(--shadow)]">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{row.ingredient_name}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setKitchen((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, keep: !r.keep } : r)),
                      )
                    }
                    className="pressable rounded-full px-3 text-sm font-semibold text-coral-text"
                  >
                    {row.keep ? "Drop" : "Keep"}
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    value={row.quantity}
                    onChange={(e) =>
                      setKitchen((rows) =>
                        rows.map((r, idx) =>
                          idx === i ? { ...r, quantity: Number(e.target.value) } : r,
                        ),
                      )
                    }
                    className="rounded-2xl bg-canvas px-3 py-2"
                    aria-label={`${row.ingredient_name} quantity`}
                  />
                  <input
                    value={row.unit}
                    onChange={(e) =>
                      setKitchen((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, unit: e.target.value } : r)),
                      )
                    }
                    className="rounded-2xl bg-canvas px-3 py-2"
                    aria-label={`${row.ingredient_name} unit`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-label">New lines</h2>
          {reviewCount > 0 ? (
            <p className="text-xs font-semibold text-amber-800">
              {reviewCount} line{reviewCount === 1 ? "" : "s"} need review
            </p>
          ) : null}
        </div>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={`${item.raw_line_text}-${i}`}
              className={`rounded-[20px] bg-card p-3 shadow-[var(--shadow)] ${
                item.needs_review ? "ring-2 ring-amber-400/50" : ""
              }`}
            >
              <input
                list="ingredient-names"
                value={item.matched_ingredient_name}
                onChange={(e) =>
                  updateItem(i, { matched_ingredient_name: e.target.value, needs_review: false })
                }
                placeholder="Ingredient"
                className="w-full min-w-0 rounded-2xl bg-canvas px-3 py-2 font-semibold"
              />
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="min-w-0 text-xs text-muted">{item.raw_line_text}</p>
                {item.needs_review ? (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    Needs review
                  </span>
                ) : null}
              </div>
              <div className="mt-2 grid min-w-0 grid-cols-3 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,4.5rem)_minmax(0,1fr)]">
                <input
                  type="number"
                  step="any"
                  value={item.quantity ?? ""}
                  onChange={(e) =>
                    updateItem(i, {
                      quantity: e.target.value === "" ? null : Number(e.target.value),
                      needs_review: false,
                    })
                  }
                  placeholder="Qty"
                  className="min-w-0 rounded-2xl bg-canvas px-3 py-2"
                />
                <input
                  value={item.unit}
                  onChange={(e) => updateItem(i, { unit: e.target.value, needs_review: false })}
                  placeholder="Unit"
                  className="min-w-0 rounded-2xl bg-canvas px-3 py-2"
                />
                <input
                  type="number"
                  step="any"
                  value={item.price ?? ""}
                  onChange={(e) =>
                    updateItem(i, {
                      price: e.target.value === "" ? null : Number(e.target.value),
                      needs_review: false,
                    })
                  }
                  placeholder="Price"
                  className="min-w-0 rounded-2xl bg-canvas px-3 py-2"
                />
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setItems((rows) => rows.filter((_, idx) => idx !== i))}
                  className="pressable rounded-full px-3 py-1.5 text-sm font-semibold text-coral-text"
                  aria-label="Delete line"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setItems((rows) => [...rows, blankLine()])}
          className="pressable mt-3 rounded-full bg-teal-soft px-4 py-2 text-sm font-semibold text-teal"
        >
          Add a line
        </button>
      </section>

      <datalist id="ingredient-names">
        {ingredients.map((i) => (
          <option key={i.ingredient_name} value={i.ingredient_name} />
        ))}
      </datalist>

      {error ? <p className="mt-4 text-sm text-coral-text">{error}</p> : null}

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await confirmAndGenerate({ receiptId, items, pantry: kitchen });
            if (!result.ok) setError(result.error);
            else router.push(`/plans/pick?generation=${result.generationId}`);
          })
        }
        className="pressable mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-teal py-4 font-semibold text-white disabled:opacity-60"
      >
        {pending ? <Spinner /> : null}
        {pending ? "Generating plans…" : "Generate plans"}
      </button>
    </div>
  );
}

function blankLine(): DraftLine {
  return {
    raw_line_text: "added by hand",
    matched_ingredient_name: "",
    quantity: 1,
    unit: "unit",
    price: null,
    needs_review: true,
  };
}
