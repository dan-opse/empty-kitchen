"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { choosePlan } from "@/app/actions/plans";
import { Spinner } from "@/components/spinner";
import type { PlanCandidate } from "@/lib/types";

export function PickPlan({ candidates }: { candidates: PlanCandidate[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div>
      <h1 className="fade-up font-display text-[2.15rem] font-semibold leading-none tracking-tight">Pick a plan</h1>
      <p className="mt-3 max-w-xl text-muted">
        Three ways to spend the same bag of groceries. You can switch later; edits on the old week are dropped.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {candidates.map((c, i) => (
          <article
            key={c.plan_id}
            className="fade-up flex flex-col rounded-[24px] bg-card p-5 shadow-[var(--shadow)] transition-shadow duration-200 hover:shadow-[0_10px_32px_rgba(22,40,48,0.12)]"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-label">Plan {c.plan_rank}</p>
            <p className="mt-2 font-display text-xl font-semibold leading-snug">{c.summary_text}</p>
            <p className="mt-2 text-sm text-muted">{Math.round(c.grocery_utilization_pct)}% of the haul used</p>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="font-bold uppercase tracking-wide text-label">Lunch · </span>
                {c.day1.lunch ?? "nothing planned"}
              </p>
              <p>
                <span className="font-bold uppercase tracking-wide text-label">Dinner · </span>
                {c.day1.dinner ?? "nothing planned"}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await choosePlan(c.plan_id);
                  if (result.ok) router.push("/");
                })
              }
              className="pressable mt-auto flex w-full items-center justify-center gap-2 rounded-full bg-teal py-3 font-semibold text-white disabled:opacity-60"
            >
              {pending ? <Spinner /> : null}
              Use this week
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
