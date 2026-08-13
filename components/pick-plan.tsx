"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { choosePlan } from "@/app/actions/plans";
import { Spinner } from "@/components/spinner";
import type { PlanCandidate, PlanSlot } from "@/lib/types";

export function PickPlan({
  candidates,
  title = "Pick a plan",
  description = "Three ways to spend the same bag of groceries. You can switch later; edits on the old week are dropped.",
  showHeading = true,
}: {
  candidates: PlanCandidate[];
  title?: string;
  description?: string;
  showHeading?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto max-w-2xl">
      {showHeading ? (
        <>
          <h1 className="fade-up font-display text-[2.15rem] font-semibold leading-none tracking-tight">{title}</h1>
          <p className="mt-3 max-w-xl text-muted">{description}</p>
        </>
      ) : null}
      <div className={`grid gap-4 md:grid-cols-3 ${showHeading ? "mt-8" : ""}`}>
        {candidates.map((c, i) => {
          const days = Math.max(1, c.days);
          const meals = c.slots.filter((s) => s.recipe_id).length;
          return (
            <article
              key={c.plan_id}
              className={`fade-up flex flex-col rounded-[24px] p-6 shadow-[var(--shadow)] transition-shadow duration-200 hover:shadow-[0_10px_32px_rgba(22,40,48,0.12)] ${
                c.selected ? "bg-teal-soft ring-2 ring-teal/40" : "bg-card"
              }`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-label">
                  Plan {c.plan_rank}
                  {c.selected ? " · active" : ""}
                </p>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-label">
                  {days} {days === 1 ? "day" : "days"} · {meals} {meals === 1 ? "meal" : "meals"}
                </span>
              </div>

              <div className="mt-4 space-y-3 rounded-2xl bg-canvas-deep/40 p-3">
                {groupDays(c.slots, days).map((g) => (
                  <div key={g.day}>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-label">Day {g.day}</p>
                    <div className="mt-1 grid grid-cols-[3.75rem_1fr] gap-x-2 gap-y-1 text-sm">
                      <span className="font-semibold text-label">Lunch</span>
                      <span className="truncate text-ink/90">{g.lunch ?? "Nothing planned"}</span>
                      <span className="font-semibold text-label">Dinner</span>
                      <span className="truncate text-ink/90">{g.dinner ?? "Nothing planned"}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                {c.grocery_list.length > 0 ? (
                  <details className="rounded-2xl bg-canvas-deep/40 p-3 text-sm">
                    <summary className="cursor-pointer font-semibold text-label">
                      Buy {c.grocery_list.length} {c.grocery_list.length === 1 ? "item" : "items"}
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {c.grocery_list.map((g) => (
                        <li key={g.ingredient_name} className="flex justify-between gap-2">
                          <span className="truncate">{g.ingredient_name}</span>
                          <span className="shrink-0 tabular-nums text-muted">
                            {formatQty(g.quantity)} {g.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p className="text-sm text-muted">{Math.round(c.grocery_utilization_pct)}% of the haul used</p>
                )}
              </div>

              <button
                type="button"
                disabled={pending || c.selected}
                onClick={() =>
                  start(async () => {
                    const result = await choosePlan(c.plan_id);
                    if (result.ok) router.push("/");
                  })
                }
                className="pressable mt-auto flex w-full items-center justify-center gap-2 rounded-full bg-teal py-3 font-semibold text-white disabled:opacity-60"
              >
                {pending ? <Spinner /> : null}
                {c.selected ? "Active plan" : "Use this week"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function groupDays(slots: PlanSlot[], days: number): { day: number; lunch: string | null; dinner: string | null }[] {
  const groups: { day: number; lunch: string | null; dinner: string | null }[] = [];
  for (let d = 1; d <= days; d++) {
    const lunch = slots.find((s) => s.day_number === d && s.meal_slot === "lunch")?.recipe_name ?? null;
    const dinner = slots.find((s) => s.day_number === d && s.meal_slot === "dinner")?.recipe_name ?? null;
    groups.push({ day: d, lunch, dinner });
  }
  return groups;
}

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 100) / 100);
}
