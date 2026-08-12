"use client";

import type { PlanSlot } from "@/lib/types";

export function MealRow({
  slot,
  onEdit,
  compact = false,
}: {
  slot: PlanSlot;
  onEdit?: () => void;
  compact?: boolean;
}) {
  if (!slot.recipe_id) {
    return (
      <div
        className={`flex items-center rounded-2xl border border-dashed border-line/80 bg-white/30 px-3 text-sm text-muted ${
          compact ? "min-h-12" : "min-h-14"
        }`}
      >
        Nothing planned
      </div>
    );
  }

  const meta = [
    slot.is_leftover ? "Leftover" : "Cook",
    "1 serving",
    slot.modified ? "Modified" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <div className="min-w-0 flex-1">
      <p
        className={`font-display font-semibold leading-snug text-ink ${
          compact ? "text-sm" : "text-base"
        }`}
      >
        {slot.recipe_name}
      </p>
      <p className={`mt-0.5 text-muted ${compact ? "text-xs" : "text-sm"}`}>{meta}</p>
    </div>
  );

  if (!onEdit) {
    return (
      <div className={`flex rounded-2xl bg-card px-3.5 shadow-[var(--shadow)] ${compact ? "py-2.5" : "py-3"}`}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      className={`pressable group flex w-full items-start gap-2 rounded-2xl bg-card px-3.5 text-left shadow-[var(--shadow)] transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_28px_rgba(22,40,48,0.12)] ${
        compact ? "py-2.5" : "py-3"
      }`}
      aria-label={`Edit ${slot.recipe_name}`}
    >
      {body}
      <span className="shrink-0 pt-0.5 text-xs font-semibold text-teal/0 transition-colors duration-200 group-hover:text-teal">
        Edit
      </span>
    </button>
  );
}
