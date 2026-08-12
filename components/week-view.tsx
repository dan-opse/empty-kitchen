"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DayStrip } from "@/components/day-strip";
import { MealDetailPanel } from "@/components/meal-detail";
import { MealRow } from "@/components/meal-row";
import { choosePlan, fetchMealDetail } from "@/app/actions/plans";
import { ACTIVE_PLAN_CACHE_KEY, type ActiveWeek, type MealDetail, type MealSlot, type PlanSlot } from "@/lib/types";
import { addDaysISO, clamp, daysFromStart, spelledDate, weekdayShort, dateNumber } from "@/lib/dates";

const DAY_RANGE_OPTIONS = [1, 2, 3, 4, 5, 7] as const;

export function WeekView({ week }: { week: ActiveWeek }) {
  const router = useRouter();
  const initialDay = clamp(daysFromStart(week.start_date) + 1, 1, 7);
  const [day, setDay] = useState(initialDay);
  const [dayRange, setDayRange] = useState<number>(3);
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

  const visibleDays = useMemo(() => {
    const start = day;
    const days: number[] = [];
    for (let i = 0; i < dayRange; i++) {
      const d = start + i;
      if (d > 7) break;
      days.push(d);
    }
    return days;
  }, [day, dayRange]);

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
      startDate={week.start_date}
      weekSlots={week.slots}
      onClose={() => {
        setDetail(null);
        router.refresh();
      }}
    />
  ) : null;

  return (
    <div className={`relative ${detail ? "md:pr-[400px]" : ""} transition-[padding] duration-300 ease-out`}>
      <header className="fade-up mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[2.15rem] font-semibold leading-none tracking-tight">Meal Plan</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{week.summary_text}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSwitchOpen(true)}
            className="btn-secondary pressable hidden items-center md:inline-flex"
          >
            Switch plan
          </button>
          <button
            type="button"
            onClick={() => setPlusOpen(true)}
            className="btn-accent pressable inline-flex items-center justify-center"
          >
            Add
          </button>
        </div>
      </header>

      {/* Mobile: day strip + single day */}
      <div className="md:hidden">
        <DayStrip startDate={week.start_date} selectedDay={day} onSelect={setDay} />
        <p className="mt-5 font-display text-xl font-semibold">{spelledDate(iso)}</p>
        <div key={day} className="mt-5">
          <DayMeals lunch={lunch} dinner={dinner} onEdit={openDetail} />
        </div>
      </div>

      {/* Desktop: range control + calendar columns */}
      <div className="hidden md:block">
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-label">Starts on</p>
          <DayStrip startDate={week.start_date} selectedDay={day} onSelect={setDay} compact />
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-label">Show next</p>
            <div
              className="mt-2 inline-flex flex-wrap gap-1 rounded-full bg-white/55 p-1 shadow-[var(--shadow)]"
              role="group"
              aria-label="Number of days to show"
            >
              {DAY_RANGE_OPTIONS.map((n) => {
                const selected = dayRange === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDayRange(n)}
                    aria-pressed={selected}
                    className={`pressable inline-flex min-h-10 items-center justify-center rounded-full px-3.5 py-2 text-sm font-semibold tabular-nums transition-[background-color,color,transform] duration-200 ${
                      selected
                        ? "bg-teal text-white shadow-sm"
                        : "text-muted hover:bg-canvas-deep hover:text-ink"
                    }`}
                  >
                    {n}
                    <span className="ml-1 font-medium opacity-70">{n === 1 ? "day" : "days"}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-sm text-muted">
            Showing {visibleDays.length} day{visibleDays.length === 1 ? "" : "s"} from{" "}
            <span className="font-semibold text-ink">{spelledDate(iso)}</span>
          </p>
        </div>

        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0, 1fr))`,
          }}
        >
          {visibleDays.map((d, index) => {
            const date = addDaysISO(week.start_date, d - 1);
            const isAnchor = d === day;
            return (
              <section
                key={d}
                className={`fade-up flex min-w-0 flex-col rounded-[22px] border p-3.5 transition-[border-color,background-color,box-shadow] duration-200 ${
                  isAnchor
                    ? "border-teal/25 bg-white shadow-[var(--shadow)]"
                    : "border-transparent bg-white/45 hover:border-line/80 hover:bg-white/70"
                }`}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="mb-3 px-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">
                    {weekdayShort(date)}
                  </p>
                  <p className="font-display text-2xl font-semibold tabular-nums leading-none tracking-tight">
                    {dateNumber(date)}
                  </p>
                </div>
                <DayMeals
                  compact
                  lunch={week.slots.find((s) => s.day_number === d && s.meal_slot === "lunch")}
                  dinner={week.slots.find((s) => s.day_number === d && s.meal_slot === "dinner")}
                  onEdit={(slot) => {
                    void openDetail(slot);
                  }}
                />
              </section>
            );
          })}
        </div>

        {day + dayRange - 1 > 7 ? (
          <p className="mt-3 text-sm text-muted">
            Only {visibleDays.length} day{visibleDays.length === 1 ? "" : "s"} left in this week from the selected start.
          </p>
        ) : null}
      </div>

      {plusOpen ? (
        <Sheet onClose={() => setPlusOpen(false)}>
          <h2 className="font-display text-xl font-semibold">Add to this week</h2>
          <Link href="/groceries" className="btn-primary pressable mt-4 flex w-full items-center justify-center">
            Add groceries
          </Link>
          <button
            type="button"
            onClick={() => {
              setPlusOpen(false);
              setSwitchOpen(true);
            }}
            className="btn-secondary pressable mt-2 flex w-full items-center justify-center"
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
                  className="pressable w-full rounded-[20px] bg-white p-4 text-left shadow-[var(--shadow)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(22,40,48,0.12)] disabled:opacity-60"
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
          <div
            className="sheet-backdrop fixed inset-0 z-40 bg-ink/30 md:hidden"
            onClick={() => setDetail(null)}
          />
          <div className="sheet-panel fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[28px] bg-card p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:hidden">
            {detailPanel}
          </div>
          <aside className="panel-in-right fixed inset-y-0 right-0 z-40 hidden w-[380px] overflow-y-auto border-l border-line bg-card p-6 shadow-[var(--shadow)] md:block">
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
  compact = false,
}: {
  lunch?: PlanSlot;
  dinner?: PlanSlot;
  onEdit: (slot: PlanSlot) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      <section>
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-label">Lunch</h2>
        {lunch ? <MealRow slot={lunch} onEdit={() => onEdit(lunch)} compact={compact} /> : null}
      </section>
      <section>
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-label">Dinner</h2>
        {dinner ? <MealRow slot={dinner} onEdit={() => onEdit(dinner)} compact={compact} /> : null}
      </section>
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        className="sheet-backdrop absolute inset-0 bg-ink/30"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="sheet-panel absolute inset-x-0 bottom-0 rounded-t-[28px] bg-card p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:inset-auto md:bottom-8 md:right-8 md:w-96 md:rounded-[28px]">
        {children}
      </div>
    </div>
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
      <div className="fade-up mt-6 flex flex-col gap-2" style={{ animationDelay: "80ms" }}>
        {pendingGenerationId ? (
          <Link href={`/plans/pick?generation=${pendingGenerationId}`} className="btn-primary pressable flex items-center justify-center">
            Review 3 plans
          </Link>
        ) : null}
        <Link href="/groceries" className="btn-primary pressable flex items-center justify-center">
          Add groceries
        </Link>
        {recipeCount === 0 ? (
          <Link href="/import" className="btn-secondary pressable flex items-center justify-center">
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
        <DayStrip startDate={start} selectedDay={1} onSelect={() => undefined} disabled />
      </div>
      <div className="mt-8">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-label">Lunch</h2>
        <div className="flex min-h-14 items-center rounded-2xl border border-dashed border-line/80 bg-white/40 px-4 text-sm text-muted">
          Nothing planned
        </div>
        <h2 className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-label">Dinner</h2>
        <div className="flex min-h-14 items-center rounded-2xl border border-dashed border-line/80 bg-white/40 px-4 text-sm text-muted">
          Nothing planned
        </div>
      </div>
      {children}
    </div>
  );
}
