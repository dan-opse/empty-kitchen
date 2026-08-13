"use client";

import { addDaysISO, dateNumber, weekdayShort } from "@/lib/dates";

export function DayStrip({
  startDate,
  selectedDay,
  onSelect,
  compact = false,
  disabled = false,
  maxDay = 7,
}: {
  startDate: string;
  selectedDay: number;
  onSelect: (day: number) => void;
  compact?: boolean;
  disabled?: boolean;
  maxDay?: number;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysISO(startDate, i);
    return { day: i + 1, iso, label: weekdayShort(iso), num: dateNumber(iso) };
  });

  return (
    <div className={`flex ${compact ? "justify-between" : "gap-1 overflow-x-auto"} pb-1`}>
      {days.map((d) => {
        const selected = d.day === selectedDay;
        const beyondPlan = d.day > maxDay;
        const isDisabled = disabled || beyondPlan;
        return (
          <button
            key={d.day}
            type="button"
            disabled={isDisabled}
            onClick={() => onSelect(d.day)}
            className={`pressable flex min-h-16 min-w-12 flex-col items-center justify-center rounded-2xl px-2 text-center disabled:cursor-not-allowed ${
              selected
                ? "bg-teal text-white shadow-[0_6px_16px_rgba(0,90,84,0.22)]"
                : beyondPlan
                  ? "text-muted/50"
                  : "text-muted hover:bg-white/70 hover:text-ink"
            } ${isDisabled ? "opacity-50" : ""}`}
            aria-pressed={selected}
            aria-disabled={isDisabled}
            aria-label={`${d.label} ${d.num}`}
          >
            <span className="text-[11px] font-bold tracking-wide">{d.label}</span>
            <span className="font-display text-lg font-semibold leading-none tabular-nums">{d.num}</span>
          </button>
        );
      })}
    </div>
  );
}
