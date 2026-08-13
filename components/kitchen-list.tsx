"use client";

import { useTransition } from "react";
import { markPantryStatus, removePantryItem } from "@/app/actions/pantry";
import type { PantryItem } from "@/lib/types";

export function KitchenList({ leftovers, staples }: { leftovers: PantryItem[]; staples: PantryItem[] }) {
  return (
    <div className="mx-auto max-w-[640px]">
      <h1 className="fade-up font-display text-[2.15rem] font-semibold leading-none tracking-tight">Kitchen</h1>
      <p className="mt-3 text-muted">
        Leftovers carry into the next scan only if they are still here. Staples are assumed in stock until you mark them out.
      </p>

      <section className="fade-up mt-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-label">Leftover / unused</h2>
        {leftovers.length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-line px-4 py-5 text-sm text-muted">
            Nothing parked from a previous haul.
          </p>
        ) : (
          <ul className="space-y-2">
            {leftovers.map((item) => (
              <PantryRow key={item.pantry_item_id} item={item} leftover />
            ))}
          </ul>
        )}
      </section>

      <section className="fade-up mt-8" style={{ animationDelay: "60ms" }}>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-label">Staples</h2>
        <ul className="space-y-2">
          {staples.map((item) => (
            <PantryRow key={item.pantry_item_id} item={item} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function PantryRow({ item, leftover }: { item: PantryItem; leftover?: boolean }) {
  const [pending, start] = useTransition();
  const inStock = item.status === "in_stock";
  const qty =
    leftover && item.quantity != null
      ? `${item.quantity} ${item.unit ?? ""}`.trim()
      : null;
  const statusLabel = inStock ? (leftover ? "Still have" : "In stock") : "Ran out";
  const actionLabel = inStock ? "Mark ran out" : leftover ? "Mark still have" : "Restock";

  return (
    <li className="flex items-center justify-between gap-3 rounded-[20px] bg-card px-4 py-3 shadow-[var(--shadow)]">
      <div className="min-w-0">
        <p className="truncate font-semibold">{item.ingredient_name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 rounded-full ${inStock ? "bg-teal" : "bg-coral-text"}`}
          />
          {qty ? `${qty} · ${statusLabel}` : statusLabel}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {leftover ? (
          <button
            type="button"
            disabled={pending}
            aria-label={`Remove ${item.ingredient_name} from kitchen`}
            onClick={() => {
              if (!window.confirm(`Remove ${item.ingredient_name} from your kitchen?`)) return;
              start(async () => {
                await removePantryItem(item.pantry_item_id);
              });
            }}
            className="pressable flex shrink-0 items-center justify-center kitchen-delete"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          aria-pressed={!inStock}
          onClick={() =>
            start(async () => {
              await markPantryStatus(item.pantry_item_id, inStock ? "ran_out" : "in_stock");
            })
          }
          className={`pressable flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${
            inStock ? "bg-canvas-deep text-ink/80 hover:bg-canvas" : "bg-teal-soft text-teal"
          }`}
        >
          {actionLabel}
        </button>
      </div>
    </li>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 6h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
