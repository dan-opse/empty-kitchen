"use client";

import { useTransition } from "react";
import { markPantryStatus } from "@/app/actions/pantry";
import type { PantryItem } from "@/lib/types";

export function KitchenList({ leftovers, staples }: { leftovers: PantryItem[]; staples: PantryItem[] }) {
  return (
    <div className="mx-auto max-w-[640px]">
      <h1 className="font-display text-[2.15rem] font-semibold leading-none tracking-tight">Kitchen</h1>
      <p className="mt-3 text-muted">
        Leftovers carry into the next scan only if they are still here. Staples are assumed in stock until you mark them out.
      </p>

      <section className="mt-8">
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

      <section className="mt-8">
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

  return (
    <li className="flex items-center justify-between gap-3 rounded-[20px] bg-card px-4 py-3 shadow-[var(--shadow)]">
      <div>
        <p className="font-semibold">{item.ingredient_name}</p>
        <p className="text-sm text-muted">{qty ?? (inStock ? "In stock" : "Ran out")}</p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await markPantryStatus(item.pantry_item_id, inStock ? "ran_out" : "in_stock");
          })
        }
        className={`rounded-full px-4 text-sm font-semibold ${
          inStock ? "bg-teal-soft text-teal" : "bg-canvas-deep text-muted"
        }`}
      >
        {inStock ? (leftover ? "Still have" : "In stock") : "Ran out"}
      </button>
    </li>
  );
}
