"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { choosePlan, generatePlansOnDemand, removeAllSavedPlans, removeCurrentPlan } from "@/app/actions/plans";
import { PickPlan } from "@/components/pick-plan";
import { Sheet } from "@/components/sheet";
import { Spinner } from "@/components/spinner";
import { spelledDate } from "@/lib/dates";
import type { ActiveWeek, GenerateMode, PlanHistoryGeneration } from "@/lib/types";

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export function GeneratePlans({
  configured,
  pantryEmpty,
  pendingGenerationId,
  activeWeek,
  history = [],
}: {
  configured: boolean;
  pantryEmpty: boolean;
  pendingGenerationId?: string | null;
  activeWeek?: ActiveWeek | null;
  history?: PlanHistoryGeneration[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [days, setDays] = useState<number>(7);
  const [mode, setMode] = useState<GenerateMode>(pantryEmpty ? "grocery-list" : "use-kitchen");
  const [error, setError] = useState<string | null>(null);
  const [deleteActiveOpen, setDeleteActiveOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  if (!configured) {
    return (
      <div>
        <h1 className="font-display text-[2.15rem] font-semibold leading-none tracking-tight">Plans</h1>
        <p className="mt-4 max-w-md text-muted">
          Add Supabase and OpenAI keys to <code className="font-semibold">.env.local</code> to start generating plans.
        </p>
      </div>
    );
  }

  function generate() {
    setError(null);
    start(async () => {
      const result = await generatePlansOnDemand({ days, mode });
      if (result.ok) {
        router.push(`/plans/pick?generation=${result.generationId}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <div className="mx-auto max-w-2xl">
        <h1 className="fade-up font-display text-[2.15rem] font-semibold leading-none tracking-tight">Plans</h1>
        <p className="fade-up mt-3 text-muted" style={{ animationDelay: "40ms" }}>
          Generate a meal plan from what is in your kitchen, or plan ahead with a grocery list of items to buy.
        </p>

        {activeWeek ? (
          <div
            className="fade-up mt-6 rounded-[20px] bg-teal-soft p-4 shadow-[var(--shadow)]"
            style={{ animationDelay: "80ms" }}
          >
            <p className="text-sm font-semibold text-teal">You already have an active plan this week.</p>
            <p className="mt-1 text-sm text-muted">
              These are the three plans from your current haul. Pick a different one to switch — edits on the old week are dropped.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDeleteActiveOpen(true)}
                className="btn-danger pressable inline-flex items-center justify-center"
              >
                Delete current plan
              </button>
            </div>
          </div>
        ) : null}

        {history.length > 0 ? (
          <div className="fade-up mt-4" style={{ animationDelay: "90ms" }}>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="btn-secondary pressable inline-flex items-center justify-center"
            >
              Previous plans
            </button>
          </div>
        ) : null}

        {pendingGenerationId ? (
          <div className="fade-up mt-6 rounded-[20px] bg-card p-4 shadow-[var(--shadow)]" style={{ animationDelay: "80ms" }}>
            <p className="text-sm text-muted">You already have candidate plans ready to review.</p>
            <Link
              href={`/plans/pick?generation=${pendingGenerationId}`}
              className="btn-secondary pressable mt-3 inline-flex items-center justify-center"
            >
              Review existing plans
            </Link>
          </div>
        ) : null}

        <section className="fade-up mt-8" style={{ animationDelay: "120ms" }}>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-label">Plan length</p>
          <div
            className="mt-2 inline-flex flex-wrap gap-1 rounded-full bg-white/55 p-1 shadow-[var(--shadow)]"
            role="group"
            aria-label="Number of days for the plan"
          >
            {DAY_OPTIONS.map((n) => {
              const selected = days === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDays(n)}
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
        </section>

        <section className="fade-up mt-8" style={{ animationDelay: "160ms" }}>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-label">Mode</p>
          {pantryEmpty ? (
            <div className="mt-2 rounded-[20px] border border-dashed border-line/80 bg-white/40 p-4 text-sm text-muted">
              Your kitchen has no groceries on hand. We will plan {days * 2} meals and give you a grocery list of items to buy.
            </div>
          ) : (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <ModeCard
                selected={mode === "use-kitchen"}
                onSelect={() => setMode("use-kitchen")}
                title="Use what is in the kitchen"
                body="Plan meals only from groceries you already have. Best when your kitchen is well stocked."
              />
              <ModeCard
                selected={mode === "grocery-list"}
                onSelect={() => setMode("grocery-list")}
                title="Add a grocery list"
                body="Use what you have and list the extra items to buy for the rest of the meals."
              />
            </div>
          )}
        </section>

        {error ? (
          <p className="fade-up mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>
        ) : null}

        <div className="fade-up mt-8" style={{ animationDelay: "200ms" }}>
          <button
            type="button"
            disabled={pending}
            onClick={generate}
            className="btn-primary pressable inline-flex items-center justify-center gap-2"
          >
            {pending ? <Spinner /> : null}
            Generate {days} day{days === 1 ? "" : "s"} of plans
          </button>
        </div>
      </div>

      {activeWeek ? (
        <div className="mt-10">
          <PickPlan candidates={activeWeek.candidates} showHeading={false} />
        </div>
      ) : null}

      {deleteActiveOpen ? (
        <Sheet onClose={() => setDeleteActiveOpen(false)} labelledBy="delete-active-title">
          <h2 id="delete-active-title" className="font-display text-xl font-semibold">
            Delete current plan?
          </h2>
          <p className="mt-2 text-sm text-muted">
            This removes the active plan. Other candidates from the last two weeks stay in Previous plans until they expire.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setDeleteActiveOpen(false)}
              className="btn-secondary pressable inline-flex flex-1 items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await removeCurrentPlan();
                  setDeleteActiveOpen(false);
                  router.refresh();
                })
              }
              className="btn-danger pressable inline-flex flex-1 items-center justify-center gap-2 disabled:opacity-60"
            >
              {pending ? <Spinner /> : null}
              Delete plan
            </button>
          </div>
        </Sheet>
      ) : null}

      {historyOpen ? (
        <Sheet onClose={() => setHistoryOpen(false)} labelledBy="history-title" wide>
          <h2 id="history-title" className="font-display text-xl font-semibold">
            Previous plans
          </h2>
          <p className="mt-2 text-sm text-muted">
            Plans from the last 14 days. Restore one to make it active, or delete everything saved.
          </p>
          <ul className="mt-4 space-y-5">
            {history.map((generation) => (
              <li key={generation.generation_id}>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-label">
                  Started {spelledDate(generation.start_date)}
                </p>
                <ul className="mt-2 space-y-2">
                  {generation.plans.map((plan) => (
                    <li key={plan.plan_id}>
                      <button
                        type="button"
                        disabled={pending || plan.selected}
                        onClick={() =>
                          start(async () => {
                            await choosePlan(plan.plan_id);
                            setHistoryOpen(false);
                            router.refresh();
                          })
                        }
                        className="pressable w-full rounded-[20px] bg-white p-4 text-left shadow-[var(--shadow)] disabled:opacity-60"
                      >
                        <p className="text-xs font-bold uppercase tracking-wide text-label">
                          Plan {plan.plan_rank}
                          {plan.selected ? " · active" : ""}
                          {" · "}
                          {plan.days} day{plan.days === 1 ? "" : "s"}
                        </p>
                        <p className="mt-1 font-semibold">{plan.summary_text}</p>
                        <p className="text-sm text-muted">{Math.round(plan.grocery_utilization_pct)}% of the haul used</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setDeleteAllOpen(true)}
            className="btn-danger pressable mt-5 flex w-full items-center justify-center"
          >
            Delete all saved plans
          </button>
        </Sheet>
      ) : null}

      {deleteAllOpen ? (
        <Sheet onClose={() => setDeleteAllOpen(false)} labelledBy="delete-all-title" nested>
          <h2 id="delete-all-title" className="font-display text-xl font-semibold">
            Delete all saved plans?
          </h2>
          <p className="mt-2 text-sm text-muted">
            This permanently removes every saved meal plan, including the active week. You will need to generate a new one.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setDeleteAllOpen(false)}
              className="btn-secondary pressable inline-flex flex-1 items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await removeAllSavedPlans();
                  setDeleteAllOpen(false);
                  setHistoryOpen(false);
                  router.refresh();
                })
              }
              className="btn-danger pressable inline-flex flex-1 items-center justify-center gap-2 disabled:opacity-60"
            >
              {pending ? <Spinner /> : null}
              Delete all
            </button>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

function ModeCard({
  selected,
  onSelect,
  title,
  body,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`pressable rounded-[20px] p-4 text-left transition-[border-color,background-color,box-shadow] duration-200 ${
        selected
          ? "border-teal/25 bg-white shadow-[var(--shadow)]"
          : "border border-transparent bg-white/45 hover:bg-white/70"
      }`}
    >
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </button>
  );
}
