"use client";

import { addDaysISO, dateNumber, weekdayShort } from "@/lib/dates";

export function DayStrip({
  startDate,
  selectedDay,
  onSelect,
  compact = false,
}: {
  startDate: string;
  selectedDay: number;
  onSelect: (day: number) => void;
  compact?: boolean;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysISO(startDate, i);
    return { day: i + 1, iso, label: weekdayShort(iso), num: dateNumber(iso) };
  });

  return (
    <div className={`flex ${compact ? "justify-between" : "gap-1 overflow-x-auto"} pb-1`}>
      {days.map((d) => {
        const selected = d.day === selectedDay;
        return (
          <button
            key={d.day}
            type="button"
            onClick={() => onSelect(d.day)}
            className={`flex min-h-16 min-w-12 flex-col items-center justify-center rounded-full px-2 text-center ${
              selected ? "bg-teal text-white" : "text-muted"
            }`}
            aria-pressed={selected}
            aria-label={`${d.label} ${d.num}`}
          >
            <span className="text-[11px] font-bold tracking-wide">{d.label}</span>
            <span className="font-display text-lg font-semibold leading-none">{d.num}</span>
          </button>
        );
      })}
    </div>
  );
}
