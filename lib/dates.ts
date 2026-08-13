export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function todayISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return todayISO(date);
}

export function daysFromStart(startIso: string, date = new Date()): number {
  const start = parseISODate(startIso);
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((b - a) / 86_400_000);
}

export function weekdayShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
}

export function dateNumber(iso: string): number {
  return parseISODate(iso).getDate();
}

export function spelledDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
