"use client";

import { useState, useTransition } from "react";
import { clearMeal, relocateMeal, shiftMealBack } from "@/app/actions/plans";
import { addDaysISO, dateNumber, weekdayShort } from "@/lib/dates";
import type { MealDetail, MealSlot, PlanSlot } from "@/lib/types";

export function MealDetailPanel({
  planId,
  day,
  meal,
  detail,
  startDate,
  weekSlots,
  days,
  onClose,
}: {
  planId: string;
  day: number;
  meal: MealSlot;
  detail: MealDetail;
  startDate: string;
  weekSlots: PlanSlot[];
  days: number;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, close = true) {
    start(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Something went wrong");
      else if (close) onClose();
    });
  }

  const iso = addDaysISO(startDate, day - 1);

  return (
    <div className="fade-in flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-label">
            {weekdayShort(iso)} {dateNumber(iso)} · {meal}
          </p>
          <h2 className="font-display text-2xl font-semibold">
            {detail.slot.recipe_name ?? "Empty slot"}
          </h2>
          <p className="text-sm text-muted">
            {detail.slot.is_leftover ? "Leftover" : "Cook"} · 1 serving
            {detail.slot.modified ? " · modified" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="pressable inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-muted hover:bg-canvas-deep hover:text-ink"
        >
          Close
        </button>
      </div>

      {detail.ingredients.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {detail.ingredients.map((ing) => (
            <li key={ing.name} className="flex justify-between rounded-2xl bg-canvas-deep/60 px-3 py-2 text-sm">
              <span>
                {ing.name}
                {ing.swappedFrom ? (
                  <span className="text-muted"> (for {ing.swappedFrom})</span>
                ) : null}
                {ing.missing ? <span className="text-coral-text"> · missing optional</span> : null}
              </span>
              <span className="text-muted">
                {ing.quantity} {ing.unit}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {detail.instructions ? (
        <p className="mb-4 whitespace-pre-wrap text-sm leading-6 text-ink/80">{detail.instructions}</p>
      ) : null}

      {error ? <p className="mb-3 text-sm text-coral-text">{error}</p> : null}

      {detail.slot.recipe_id ? (
        <div className="mt-auto grid gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => shiftMealBack(planId, day, meal))}
            className="btn-primary pressable flex w-full items-center justify-center disabled:opacity-60"
          >
            Push back a day
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMoveOpen((v) => !v)}
            aria-expanded={moveOpen}
            className="btn-secondary pressable flex w-full items-center justify-center disabled:opacity-60"
          >
            {moveOpen ? "Hide slots" : "Move to another slot"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => clearMeal(planId, day, meal))}
            className="pressable flex items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-coral-text hover:bg-coral/10 disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      ) : null}

      {moveOpen ? (
        <div className="fade-up mt-3 grid grid-cols-2 gap-2">
          {Array.from({ length: days }, (_, i) => i + 1).flatMap((d) => {
            const cellIso = addDaysISO(startDate, d - 1);
            return (["lunch", "dinner"] as const).map((m) => {
              const isCurrent = d === day && m === meal;
              const occupant = weekSlots.find((s) => s.day_number === d && s.meal_slot === m);
              return (
                <button
                  key={`${d}-${m}`}
                  type="button"
                  disabled={pending || isCurrent}
                  onClick={() => run(() => relocateMeal(planId, day, meal, d, m))}
                  className="pressable rounded-2xl bg-white px-3 py-2 text-left shadow-[var(--shadow)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(22,40,48,0.1)] disabled:opacity-40"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide text-label">
                    {weekdayShort(cellIso)} {dateNumber(cellIso)} · {m}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold">
                    {isCurrent
                      ? "Currently here"
                      : occupant?.recipe_name
                        ? `Swap with ${occupant.recipe_name}${occupant.is_leftover ? " (leftover)" : ""}`
                        : "Empty slot"}
                  </p>
                </button>
              );
            });
          })}
        </div>
      ) : null}
    </div>
  );
}
