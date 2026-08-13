"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generatePlansOnDemand } from "@/app/actions/plans";
import { PickPlan } from "@/components/pick-plan";
import { Spinner } from "@/components/spinner";
import type { ActiveWeek, GenerateMode } from "@/lib/types";

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export function GeneratePlans({
  configured,
  pantryEmpty,
  pendingGenerationId,
  activeWeek,
}: {
  configured: boolean;
  pantryEmpty: boolean;
  pendingGenerationId?: string | null;
  activeWeek?: ActiveWeek | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [days, setDays] = useState<number>(7);
  const [mode, setMode] = useState<GenerateMode>(pantryEmpty ? "grocery-list" : "use-kitchen");
  const [error, setError] = useState<string | null>(null);

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
