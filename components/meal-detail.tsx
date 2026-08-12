"use client";

import { useState, useTransition } from "react";
import { clearMeal, relocateMeal, shiftMealBack } from "@/app/actions/plans";
import type { MealDetail, MealSlot } from "@/lib/types";

export function MealDetailPanel({
  planId,
  day,
  meal,
  detail,
  onClose,
}: {
  planId: string;
  day: number;
  meal: MealSlot;
  detail: MealDetail;
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

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-label">
            {meal} · day {day}
          </p>
          <h2 className="font-display text-2xl font-semibold">
            {detail.slot.recipe_name ?? "Empty slot"}
          </h2>
          <p className="text-sm text-muted">
            {detail.slot.is_leftover ? "Leftover" : "Cook"} · 1 serving
            {detail.slot.modified ? " · modified" : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full px-3 text-sm font-semibold text-muted">
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
                {ing.missing ? <span className="text-coral"> · missing optional</span> : null}
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

      {error ? <p className="mb-3 text-sm text-coral">{error}</p> : null}

      {detail.slot.recipe_id ? (
        <div className="mt-auto grid gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => shiftMealBack(planId, day, meal))}
            className="rounded-full bg-teal px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            Push back a day
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMoveOpen((v) => !v)}
            className="rounded-full bg-teal-soft px-4 py-3 text-sm font-semibold text-teal"
          >
            Move to another slot
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => clearMeal(planId, day, meal))}
            className="rounded-full px-4 py-3 text-sm font-semibold text-coral"
          >
            Remove
          </button>
        </div>
      ) : null}

      {moveOpen ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {Array.from({ length: 7 }, (_, i) => i + 1).flatMap((d) =>
            (["lunch", "dinner"] as const).map((m) => (
              <button
                key={`${d}-${m}`}
                type="button"
                disabled={pending || (d === day && m === meal)}
                onClick={() => run(() => relocateMeal(planId, day, meal, d, m))}
                className="rounded-2xl bg-white px-3 py-2 text-left text-sm font-semibold disabled:opacity-40"
              >
                Day {d} {m}
              </button>
            )),
          )}
        </div>
      ) : null}
    </div>
  );
}
