"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DayStrip } from "@/components/day-strip";
import { MealDetailPanel } from "@/components/meal-detail";
import { MealRow } from "@/components/meal-row";
import { choosePlan, fetchMealDetail } from "@/app/actions/plans";
import { ACTIVE_PLAN_CACHE_KEY, type ActiveWeek, type MealDetail, type MealSlot, type PlanSlot } from "@/lib/types";
import { addDaysISO, clamp, daysFromStart, spelledDate } from "@/lib/dates";

export function WeekView({ week }: { week: ActiveWeek }) {
  const router = useRouter();
  const initialDay = clamp(daysFromStart(week.start_date) + 1, 1, 7);
  const [day, setDay] = useState(initialDay);
  const [plusOpen, setPlusOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [detail, setDetail] = useState<{ day: number; meal: MealSlot; data: MealDetail } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_PLAN_CACHE_KEY, JSON.stringify(week));
    } catch {
      /* ignore */
    }
    void fetch("/api/plan/active").catch(() => undefined);
  }, [week]);

  const iso = addDaysISO(week.start_date, day - 1);
  const lunch = week.slots.find((s) => s.day_number === day && s.meal_slot === "lunch");
  const dinner = week.slots.find((s) => s.day_number === day && s.meal_slot === "dinner");

  async function openDetail(slot: PlanSlot) {
    const result = await fetchMealDetail(week.plan_id, slot.day_number, slot.meal_slot);
    if (result.ok && result.detail) {
      setDetail({ day: slot.day_number, meal: slot.meal_slot, data: result.detail });
    }
  }

  const detailPanel = detail ? (
    <MealDetailPanel
      planId={week.plan_id}
      day={detail.day}
      meal={detail.meal}
      detail={detail.data}
      onClose={() => {
        setDetail(null);
        router.refresh();
      }}
    />
  ) : null;

  return (
    <div className="relative">
      <header className="mb-4 flex items-start justify-between gap-3">
        <h1 className="font-display text-[2.15rem] font-semibold leading-none tracking-tight">Meal Plan</h1>
        <button
          type="button"
          onClick={() => setSwitchOpen((v) => !v)}
          className="hidden rounded-full bg-teal px-4 text-sm font-semibold text-white md:inline-flex md:items-center"
        >
          Switch plan
        </button>
      </header>

      <div className="md:hidden">
        <DayStrip startDate={week.start_date} selectedDay={day} onSelect={setDay} />
      </div>
      <div className="hidden md:block">
        <DayStrip startDate={week.start_date} selectedDay={day} onSelect={setDay} compact />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="font-display text-xl font-semibold">{spelledDate(iso)}</p>
        <button
          type="button"
          onClick={() => setPlusOpen(true)}
          className="grid h-12 w-12 place-items-center rounded-full bg-coral text-white shadow-[var(--shadow)]"
          aria-label="Add groceries or switch plan"
        >
          <PlusIcon />
        </button>
      </div>

      <p className="mt-2 text-sm text-muted">{week.summary_text}</p>

      <div className="mt-6 md:hidden">
        <DayMeals lunch={lunch} dinner={dinner} onEdit={openDetail} />
      </div>

      <div className="mt-8 hidden gap-3 md:grid md:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => i + 1).map((d) => {
          const date = addDaysISO(week.start_date, d - 1);
          const selected = d === day;
          return (
            <section
              key={d}
              className={`rounded-[24px] p-3 ${selected ? "bg-white/80 ring-2 ring-teal/30" : "bg-white/35"}`}
            >
              <button type="button" onClick={() => setDay(d)} className="mb-3 w-full text-left">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">{spelledDate(date)}</p>
              </button>
              <DayMeals
                lunch={week.slots.find((s) => s.day_number === d && s.meal_slot === "lunch")}
                dinner={week.slots.find((s) => s.day_number === d && s.meal_slot === "dinner")}
                onEdit={(slot) => {
                  setDay(d);
                  void openDetail(slot);
                }}
              />
            </section>
          );
        })}
      </div>

      {plusOpen ? (
        <Sheet onClose={() => setPlusOpen(false)}>
          <h2 className="font-display text-xl font-semibold">Add to this week</h2>
          <Link
            href="/groceries"
            className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-teal font-semibold text-white"
          >
            Add groceries
          </Link>
          <button
            type="button"
            onClick={() => {
              setPlusOpen(false);
              setSwitchOpen(true);
            }}
            className="mt-2 flex min-h-12 w-full items-center justify-center rounded-full bg-teal-soft font-semibold text-teal"
          >
            Switch candidate plan
          </button>
        </Sheet>
      ) : null}

      {switchOpen ? (
        <Sheet onClose={() => setSwitchOpen(false)}>
          <h2 className="font-display text-xl font-semibold">Other plans from this haul</h2>
          <ul className="mt-4 space-y-3">
            {week.candidates.map((c) => (
              <li key={c.plan_id}>
                <button
                  type="button"
                  disabled={pending || c.selected}
                  onClick={() =>
                    start(async () => {
                      await choosePlan(c.plan_id);
                      setSwitchOpen(false);
                      router.refresh();
                    })
                  }
                  className="w-full rounded-[20px] bg-white p-4 text-left shadow-[var(--shadow)] disabled:opacity-60"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-label">
                    Plan {c.plan_rank}
                    {c.selected ? " · active" : ""}
                  </p>
                  <p className="mt-1 font-semibold">{c.summary_text}</p>
                  <p className="text-sm text-muted">{Math.round(c.grocery_utilization_pct)}% of the haul used</p>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      ) : null}

      {detail ? (
        <>
          <div className="fixed inset-0 z-40 bg-ink/30 md:hidden" onClick={() => setDetail(null)} />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[28px] bg-card p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:hidden">
            {detailPanel}
          </div>
          <aside className="fixed inset-y-0 right-0 z-40 hidden w-[380px] overflow-y-auto border-l border-line bg-card p-6 shadow-[var(--shadow)] md:block">
            {detailPanel}
          </aside>
        </>
      ) : null}
    </div>
  );
}

function DayMeals({
  lunch,
  dinner,
  onEdit,
}: {
  lunch?: PlanSlot;
  dinner?: PlanSlot;
  onEdit: (slot: PlanSlot) => void;
}) {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-label">Lunch</h2>
        {lunch ? <MealRow slot={lunch} onEdit={() => onEdit(lunch)} /> : null}
      </section>
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-label">Dinner</h2>
        {dinner ? <MealRow slot={dinner} onEdit={() => onEdit(dinner)} /> : null}
      </section>
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40">
      <button type="button" className="absolute inset-0 bg-ink/30" aria-label="Close" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-card p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:inset-auto md:bottom-8 md:right-8 md:w-96 md:rounded-[28px]">
        {children}
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyWeek({
  pendingGenerationId,
  recipeCount,
  configured,
}: {
  pendingGenerationId?: string | null;
  recipeCount: number;
  configured: boolean;
}) {

  if (!configured) {
    return (
      <EmptyChrome>
        <p className="mt-6 max-w-sm text-muted">
          Add Supabase and OpenAI keys to <code className="font-semibold">.env.local</code> to start planning.
        </p>
      </EmptyChrome>
    );
  }

  return (
    <EmptyChrome>
      {recipeCount === 0 ? (
        <p className="mt-6 max-w-sm text-muted">
          Recipes come from a Google Sheets CSV import. Load the sample set to try the flow.
        </p>
      ) : (
        <p className="mt-6 max-w-sm text-muted">
          Shop, then add the receipt. You will get three candidate weeks from the same haul.
        </p>
      )}
      <div className="mt-6 flex flex-col gap-2">
        {pendingGenerationId ? (
          <Link
            href={`/plans/pick?generation=${pendingGenerationId}`}
            className="flex min-h-12 items-center justify-center rounded-full bg-teal px-6 font-semibold text-white"
          >
            Review 3 plans
          </Link>
        ) : null}
        <Link
          href="/groceries"
          className="flex min-h-12 items-center justify-center rounded-full bg-teal px-6 font-semibold text-white"
        >
          Add groceries
        </Link>
        {recipeCount === 0 ? (
          <Link
            href="/import"
            className="flex min-h-12 items-center justify-center rounded-full bg-teal-soft px-6 font-semibold text-teal"
          >
            Import recipes
          </Link>
        ) : null}
      </div>
    </EmptyChrome>
  );
}

function EmptyChrome({ children }: { children: React.ReactNode }) {
  const start = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <h1 className="font-display text-[2.15rem] font-semibold leading-none tracking-tight">Meal Plan</h1>
      <div className="mt-4">
        <DayStrip startDate={start} selectedDay={1} onSelect={() => undefined} />
      </div>
      <div className="mt-8">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-label">Lunch</h2>
        <div className="flex min-h-[72px] items-center rounded-[20px] border border-dashed border-line bg-white/40 px-4 text-sm text-muted">
          nothing planned
        </div>
        <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-[0.18em] text-label">Dinner</h2>
        <div className="flex min-h-[72px] items-center rounded-[20px] border border-dashed border-line bg-white/40 px-4 text-sm text-muted">
          nothing planned
        </div>
      </div>
      {children}
    </div>
  );
}
