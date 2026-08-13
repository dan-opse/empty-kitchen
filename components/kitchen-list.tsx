"use client";

import { useMemo, useState, useTransition } from "react";
import { markPantryStatus, removePantryItem, removePantryItemsAction, savePantryNotes } from "@/app/actions/pantry";
import { Sheet } from "@/components/sheet";
import { Spinner } from "@/components/spinner";
import type { PantryItem } from "@/lib/types";

export function KitchenList({ leftovers, staples }: { leftovers: PantryItem[]; staples: PantryItem[] }) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | { ids: string[]; names: string[] }>(null);
  const [pending, start] = useTransition();
  const allItems = useMemo(() => [...leftovers, ...staples], [leftovers, staples]);
  const selectedCount = selected.size;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelect() {
    setSelecting(false);
    setSelected(new Set());
  }

  function requestDelete(ids: string[]) {
    const names = allItems.filter((item) => ids.includes(item.pantry_item_id)).map((item) => item.ingredient_name);
    setConfirm({ ids, names });
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="fade-up font-display text-[2.15rem] font-semibold leading-none tracking-tight">Kitchen</h1>
          <p className="mt-3 text-muted">
            Leftovers carry into the next scan only if they are still here. Staples are assumed in stock until you mark them out.
          </p>
        </div>
        {allItems.length > 0 ? (
          <button
            type="button"
            onClick={() => (selecting ? exitSelect() : setSelecting(true))}
            className="btn-secondary pressable inline-flex items-center justify-center"
            aria-pressed={selecting}
          >
            {selecting ? "Cancel" : "Select"}
          </button>
        ) : null}
      </header>

      <section className="fade-up mt-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-label">Leftover / unused</h2>
        {leftovers.length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-line px-4 py-5 text-sm text-muted">
            Nothing parked from a previous haul.
          </p>
        ) : (
          <ul className="space-y-2">
            {leftovers.map((item) => (
              <PantryRow
                key={item.pantry_item_id}
                item={item}
                leftover
                selecting={selecting}
                checked={selected.has(item.pantry_item_id)}
                onToggle={() => toggleSelect(item.pantry_item_id)}
                onDelete={() => requestDelete([item.pantry_item_id])}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="fade-up mt-8" style={{ animationDelay: "60ms" }}>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-label">Staples</h2>
        <ul className="space-y-2">
          {staples.map((item) => (
            <PantryRow
              key={item.pantry_item_id}
              item={item}
              selecting={selecting}
              checked={selected.has(item.pantry_item_id)}
              onToggle={() => toggleSelect(item.pantry_item_id)}
              onDelete={() => requestDelete([item.pantry_item_id])}
            />
          ))}
        </ul>
      </section>

      {selecting && selectedCount > 0 ? (
        <div className="fixed inset-x-0 bottom-[4.75rem] z-20 px-4 md:bottom-6">
          <div className="mx-auto flex max-w-[640px] items-center justify-between gap-3 rounded-[22px] bg-card p-3 shadow-[var(--shadow)]">
            <p className="px-2 text-sm font-semibold">
              {selectedCount} selected
            </p>
            <button
              type="button"
              onClick={() => requestDelete([...selected])}
              className="btn-danger pressable inline-flex items-center justify-center"
            >
              Delete {selectedCount} {selectedCount === 1 ? "item" : "items"}
            </button>
          </div>
        </div>
      ) : null}

      {confirm ? (
        <Sheet onClose={() => setConfirm(null)} labelledBy="remove-items-title">
          <h2 id="remove-items-title" className="font-display text-xl font-semibold">
            {confirm.ids.length === 1 ? "Remove from kitchen?" : `Remove ${confirm.ids.length} items?`}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {confirm.ids.length === 1
              ? `Remove ${confirm.names[0]} from your kitchen?`
              : `Remove ${confirm.names.slice(0, 3).join(", ")}${confirm.names.length > 3 ? `, and ${confirm.names.length - 3} more` : ""} from your kitchen?`}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="btn-secondary pressable inline-flex flex-1 items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (confirm.ids.length === 1) {
                    await removePantryItem(confirm.ids[0]);
                  } else {
                    await removePantryItemsAction(confirm.ids);
                  }
                  setConfirm(null);
                  exitSelect();
                })
              }
              className="btn-danger pressable inline-flex flex-1 items-center justify-center gap-2 disabled:opacity-60"
            >
              {pending ? <Spinner /> : null}
              Remove
            </button>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function PantryRow({
  item,
  leftover,
  selecting,
  checked,
  onToggle,
  onDelete,
}: {
  item: PantryItem;
  leftover?: boolean;
  selecting: boolean;
  checked: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [pending, start] = useTransition();
  const inStock = item.status === "in_stock";
  const qty =
    leftover && item.quantity != null
      ? `${item.quantity} ${item.unit ?? ""}`.trim()
      : null;
  const statusLabel = inStock ? (leftover ? "Still have" : "In stock") : "Ran out";
  const actionLabel = inStock ? "Mark ran out" : leftover ? "Mark still have" : "Restock";

  return (
    <li
      className={`rounded-[20px] bg-card px-4 py-3 shadow-[var(--shadow)] ${
        checked ? "ring-2 ring-teal" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {selecting ? (
            <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
              <input
                type="checkbox"
                checked={checked}
                onChange={onToggle}
                className="h-5 w-5 accent-[var(--teal)]"
                aria-label={`Select ${item.ingredient_name}`}
              />
            </label>
          ) : null}
          <div className="min-w-0">
            <p className="truncate font-semibold">{item.ingredient_name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
              <span
                aria-hidden
                className={`inline-block h-1.5 w-1.5 rounded-full ${inStock ? "bg-teal" : "bg-destructive"}`}
              />
              {qty ? `${qty} · ${statusLabel}` : statusLabel}
              {checked ? <span className="font-medium text-teal"> · selected</span> : null}
            </p>
          </div>
        </div>
        {selecting ? null : (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={pending}
              aria-label={`Remove ${item.ingredient_name} from kitchen`}
              onClick={onDelete}
              className="pressable flex shrink-0 items-center justify-center kitchen-delete"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
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
        )}
      </div>
      <NoteField item={item} />
    </li>
  );
}

function NoteField({ item }: { item: PantryItem }) {
  const [open, setOpen] = useState(Boolean(item.notes));
  const [value, setValue] = useState(item.notes ?? "");
  const [pending, start] = useTransition();
  const preview = item.notes?.trim() ?? "";

  function save() {
    const next = value.trim();
    if (next === (item.notes ?? "").trim()) return;
    start(async () => {
      await savePantryNotes(item.pantry_item_id, next);
    });
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="pressable inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl px-1 text-sm font-medium text-muted hover:text-ink"
        aria-expanded={open}
      >
        <NoteIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {preview ? (open ? "Hide note" : preview) : open ? "Hide note" : "Add note"}
        </span>
      </button>
      {open ? (
        <div className="mt-1">
          <label className="text-xs font-bold uppercase tracking-[0.16em] text-label" htmlFor={`note-${item.pantry_item_id}`}>
            Note
          </label>
          <textarea
            id={`note-${item.pantry_item_id}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={save}
            rows={2}
            disabled={pending}
            placeholder="Something you wanted to remember about this ingredient"
            className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none"
          />
          <p className="mt-1 text-xs text-muted">Saved when you leave the field.</p>
        </div>
      ) : null}
    </div>
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

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4h10l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M15 4v4h4M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
