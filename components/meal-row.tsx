"use client";

import { CategoryThumb } from "@/components/category-thumb";
import type { PlanSlot } from "@/lib/types";

export function MealRow({
  slot,
  onEdit,
}: {
  slot: PlanSlot;
  onEdit?: () => void;
}) {
  if (!slot.recipe_id) {
    return (
      <div className="flex min-h-[72px] items-center rounded-[20px] border border-dashed border-line bg-white/40 px-4 text-sm text-muted">
        nothing planned
      </div>
    );
  }

  const sub = [
    slot.is_leftover ? "Leftover" : "Cook",
    "1 serving",
    slot.modified ? "modified" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-h-[72px] items-center gap-3 rounded-[20px] bg-card px-3 py-2 shadow-[var(--shadow)]">
      <CategoryThumb tag={slot.cuisine_tag} leftover={slot.is_leftover} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base font-semibold leading-tight">{slot.recipe_name}</p>
        <p className="text-sm text-muted">{sub}</p>
      </div>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="grid h-11 w-11 place-items-center rounded-full text-muted"
          aria-label={`Edit ${slot.recipe_name}`}
        >
          <PencilIcon />
        </button>
      ) : null}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4.2L19 9.2 14.8 5 4 15.8V20Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
