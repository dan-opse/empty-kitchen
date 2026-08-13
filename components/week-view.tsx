"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DayStrip } from "@/components/day-strip";
import { MealDetailPanel } from "@/components/meal-detail";
import { MealRow } from "@/components/meal-row";
import { Sheet } from "@/components/sheet";
import { choosePlan, clearWeek, fetchMealDetail } from "@/app/actions/plans";
import { Spinner } from "@/components/spinner";
import { ACTIVE_PLAN_CACHE_KEY, type ActiveWeek, type MealDetail, type MealSlot, type PlanSlot } from "@/lib/types";
import { addDaysISO, clamp, daysFromStart, spelledDate, weekdayShort, dateNumber } from "@/lib/dates";
import { useLocalToday } from "@/lib/use-local-today";

const DAY_RANGE_OPTIONS = [1, 2, 3, 4, 5, 7] as const;

export function WeekView({ week }: { week: ActiveWeek }) {
  const router = useRouter();
  const today = useLocalToday();
  const todayPlanDay = clamp(daysFromStart(week.start_date, today) + 1, 1, week.days);
  const [day, setDay] = useState(todayPlanDay);
  const [dayRange, setDayRange] = useState<number>(Math.min(3, week.days));
  const [plusOpen, setPlusOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [groceryOpen, setGroceryOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
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

  useEffect(() => {
    setDay(clamp(daysFromStart(week.start_date) + 1, 1, week.days));
    setDayRange(Math.min(3, week.days));
  }, [week.plan_id, week.start_date, week.days]);

  useEffect(() => {
    setDay((current) => (current < todayPlanDay ? todayPlanDay : current));
  }, [todayPlanDay]);

  useEffect(() => {
    const remaining = week.days - day + 1;
    if (dayRange > remaining) setDayRange(remaining);
  }, [day, dayRange, week.days]);

  const iso = addDaysISO(week.start_date, day - 1);
  const lunch = week.slots.find((s) => s.day_number === day && s.meal_slot === "lunch");
  const dinner = week.slots.find((s) => s.day_number === day && s.meal_slot === "dinner");

  const visibleDays = useMemo(() => {
    const start = day;
    const days: number[] = [];
    for (let i = 0; i < dayRange; i++) {
      const d = start + i;
      if (d > week.days) break;
      days.push(d);
    }
    return days;
  }, [day, dayRange, week.days]);

  function selectDay(next: number) {
    setDay(next);
    const remaining = week.days - next + 1;
    if (dayRange > remaining) setDayRange(remaining);
  }

  async function openDetail(slot: PlanSlot) {
    const result = await fetchMealDetail(week.plan_id, slot.day_number, slot.meal_slot);
    if (result.ok && result.detail) {
      setDetail({ day: slot.day_number, meal: slot.meal_slot, data: result.detail });
    }
  }

  const firstRow = visibleDays.slice(0, 3);
  const secondRow = visibleDays.slice(3);

  const detailPanel = detail ? (
    <MealDetailPanel
      planId={week.plan_id}
      day={detail.day}
      meal={detail.meal}
      detail={detail.data}
      startDate={week.start_date}
      weekSlots={week.slots}
      days={week.days}
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
          {week.grocery_list.length > 0 ? (
            <button
              type="button"
              onClick={() => setGroceryOpen(true)}
              className="btn-secondary pressable inline-flex items-center"
            >
              Grocery list
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setSwitchOpen(true)}
            className="btn-secondary pressable hidden items-center md:inline-flex"
          >
            Switch plan
          </button>
          <button
            type="button"
            onClick={() => setClearOpen(true)}
            className="btn-secondary pressable inline-flex items-center"
          >
            Clear week
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
        <DayStrip
          startDate={today}
          planStartDate={week.start_date}
          selectedDay={day}
          onSelect={selectDay}
          maxDay={week.days}
        />
        <p className="mt-5 font-display text-xl font-semibold">{spelledDate(iso)}</p>
        <div key={day} className="mt-5">
          <DayMeals lunch={lunch} dinner={dinner} onEdit={openDetail} />
        </div>
      </div>

      {/* Desktop: range control + calendar columns */}
      <div className="hidden md:block">
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-label">Starts on</p>
          <DayStrip
            startDate={today}
            planStartDate={week.start_date}
            selectedDay={day}
            onSelect={selectDay}
            compact
            maxDay={week.days}
          />
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
                const beyondPlan = day + n - 1 > week.days;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={beyondPlan}
                    onClick={() => setDayRange(n)}
                    aria-pressed={selected}
                    aria-disabled={beyondPlan}
                    className={`pressable inline-flex min-h-10 items-center justify-center rounded-full px-3.5 py-2 text-sm font-semibold tabular-nums transition-[background-color,color,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
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

        <div className="space-y-4">
          <DayColumnRow
            days={firstRow}
            week={week}
            anchorDay={day}
            offset={0}
            onEdit={(slot) => {
              void openDetail(slot);
            }}
          />
          {secondRow.length > 0 ? (
            <DayColumnRow
              days={secondRow}
              week={week}
              anchorDay={day}
              offset={firstRow.length}
              onEdit={(slot) => {
                void openDetail(slot);
              }}
            />
          ) : null}
        </div>

        {day + dayRange - 1 > week.days ? (
          <p className="mt-3 text-sm text-muted">
            Only {visibleDays.length} day{visibleDays.length === 1 ? "" : "s"} left in this plan from the selected start.
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

      {groceryOpen ? (
        <Sheet onClose={() => setGroceryOpen(false)}>
          <h2 className="font-display text-xl font-semibold">Grocery list</h2>
          <p className="mt-2 text-sm text-muted">
            Items to buy for this plan. Staples are assumed on hand.
          </p>
          <ul className="mt-4 space-y-2">
            {week.grocery_list.map((g) => (
              <li key={g.ingredient_name} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-3 shadow-[var(--shadow)]">
                <span className="font-medium">{g.ingredient_name}</span>
                <span className="tabular-nums text-muted">
                  {formatQty(g.quantity)} {g.unit}
                </span>
              </li>
            ))}
          </ul>
        </Sheet>
      ) : null}

      {clearOpen ? (
        <Sheet onClose={() => setClearOpen(false)}>
          <h2 className="font-display text-xl font-semibold">Clear all meals?</h2>
          <p className="mt-2 text-sm text-muted">
            This removes the active plan for this week. Any other candidate plans from the same haul stay available to pick afterwards.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setClearOpen(false)}
              className="btn-secondary pressable inline-flex flex-1 items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await clearWeek();
                  setClearOpen(false);
                  router.refresh();
                })
              }
              className="btn-primary pressable inline-flex flex-1 items-center justify-center gap-2 disabled:opacity-60"
            >
              {pending ? <Spinner /> : null}
              Clear week
            </button>
          </div>
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

function DayColumnRow({
  days,
  week,
  anchorDay,
  offset,
  onEdit,
}: {
  days: number[];
  week: ActiveWeek;
  anchorDay: number;
  offset: number;
  onEdit: (slot: PlanSlot) => void;
}) {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
      }}
    >
      {days.map((d, index) => {
        const date = addDaysISO(week.start_date, d - 1);
        const isAnchor = d === anchorDay;
        return (
          <section
            key={d}
            className={`fade-up flex min-w-0 flex-col rounded-[22px] border p-3.5 transition-[border-color,background-color,box-shadow] duration-200 ${
              isAnchor
                ? "border-teal/25 bg-white shadow-[var(--shadow)]"
                : "border-transparent bg-white/45 hover:border-line/80 hover:bg-white/70"
            }`}
            style={{ animationDelay: `${(offset + index) * 40}ms` }}
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
              onEdit={onEdit}
            />
          </section>
        );
      })}
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

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 100) / 100);
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
  const today = useLocalToday();
  return (
    <div>
      <h1 className="font-display text-[2.15rem] font-semibold leading-none tracking-tight">Meal Plan</h1>
      <div className="mt-4">
        <DayStrip startDate={today} selectedDay={1} onSelect={() => undefined} disabled />
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
