export function CategoryThumb({
  tag,
  leftover,
}: {
  tag?: string | null;
  leftover?: boolean;
}) {
  const tone = toneFor(tag);
  return (
    <div
      className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[16px]"
      style={{ background: tone.bg }}
      aria-hidden
    >
      <svg viewBox="0 0 56 56" className="h-full w-full">
        <circle cx="28" cy="22" r="10" fill={tone.fg} opacity="0.9" />
        <rect x="14" y="32" width="28" height="12" rx="6" fill={tone.fg} opacity="0.55" />
      </svg>
      {leftover ? (
        <span className="absolute inset-x-0 bottom-0 bg-ink/55 py-0.5 text-center text-[8px] font-bold uppercase tracking-wide text-white">
          Extra
        </span>
      ) : null}
    </div>
  );
}

function toneFor(tag?: string | null) {
  const t = (tag ?? "").toLowerCase();
  if (t.includes("chicken") || t.includes("skillet")) return { bg: "#c45c4a", fg: "#f6d7d0" };
  if (t.includes("seafood") || t.includes("salad")) return { bg: "#3f7a8c", fg: "#d4eef4" };
  if (t.includes("pasta")) return { bg: "#c4a05a", fg: "#f4e6c8" };
  if (t.includes("egg")) return { bg: "#d4b06a", fg: "#fff4d8" };
  if (t.includes("stew") || t.includes("stir")) return { bg: "#5a8f6d", fg: "#dcefe3" };
  return { bg: "#005a54", fg: "#d7eeea" };
}
