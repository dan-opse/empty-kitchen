import type { ReactElement } from "react";

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
      {renderGlyph(tag, { className: "h-full w-full p-3", color: tone.fg })}
      {leftover ? (
        <span className="absolute inset-x-0 bottom-0 bg-ink/55 py-0.5 text-center text-[8px] font-bold uppercase tracking-wide text-white">
          Extra
        </span>
      ) : null}
    </div>
  );
}

type Tone = { bg: string; fg: string };

function toneFor(tag?: string | null): Tone {
  const t = (tag ?? "").toLowerCase();
  if (t.includes("chicken") || t.includes("skillet")) return { bg: "#c45c4a", fg: "#f6d7d0" };
  if (t.includes("seafood") || t.includes("fish") || t.includes("salmon") || t.includes("tuna"))
    return { bg: "#3f7a8c", fg: "#d4eef4" };
  if (t.includes("salad") || t.includes("veg")) return { bg: "#5a8f6d", fg: "#dcefe3" };
  if (t.includes("pasta") || t.includes("rice") || t.includes("grain")) return { bg: "#c4a05a", fg: "#f4e6c8" };
  if (t.includes("egg")) return { bg: "#d4b06a", fg: "#fff4d8" };
  if (t.includes("stew") || t.includes("stir") || t.includes("soup")) return { bg: "#5a8f6d", fg: "#dcefe3" };
  return { bg: "#005a54", fg: "#d7eeea" };
}

type GlyphProps = { className?: string; color: string };

function renderGlyph(tag: string | null | undefined, props: GlyphProps): ReactElement {
  const t = (tag ?? "").toLowerCase();
  if (t.includes("chicken") || t.includes("skillet") || t.includes("turkey")) return DrumstickGlyph(props);
  if (t.includes("seafood") || t.includes("fish") || t.includes("salmon") || t.includes("tuna")) return FishGlyph(props);
  if (t.includes("salad") || t.includes("veg")) return LeafGlyph(props);
  if (t.includes("pasta")) return NoodleGlyph(props);
  if (t.includes("rice") || t.includes("grain")) return GrainBowlGlyph(props);
  if (t.includes("egg")) return EggGlyph(props);
  if (t.includes("stew") || t.includes("stir") || t.includes("soup")) return PotGlyph(props);
  return BowlGlyph(props);
}

function DrumstickGlyph({ className, color }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M9.5 14.5c-2.4 2.4-2.7 4.6-1.4 5.9 1.3 1.3 3.5 1 5.9-1.4"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9.7 14.3c-2.9-2.9-3.4-7.3-1-9.7 2.4-2.4 6.8-1.9 9.7 1 2.9 2.9 3.4 7.3 1 9.7-2.4 2.4-6.8 1.9-9.7-1Z"
        fill={color}
        opacity="0.9"
      />
    </svg>
  );
}

function FishGlyph({ className, color }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M4 12c3-4 8-6 12-4 2 1 3.5 2.5 4 4-0.5 1.5-2 3-4 4-4 2-9 0-12-4Z"
        fill={color}
        opacity="0.9"
      />
      <path d="M17 10.5v3" stroke="#00000022" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7.2" cy="11" r="0.9" fill="#00000033" />
    </svg>
  );
}

function LeafGlyph({ className, color }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M5 19c-1-6 1.5-11 7-13.5C17 3 20 6 19.5 11 19 16.5 13.5 20 8 19c-1 0-2.2-0.3-3-1Z"
        fill={color}
        opacity="0.9"
      />
      <path d="M6.5 18C10 13.5 13.5 10 18 7" stroke="#00000022" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function NoodleGlyph({ className, color }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M4 16c4 3 12 3 16 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M6 15c1-3.5 0-6-1-8.5M12 15.5c0.6-4 0.6-7 0-10M18 15c1-3.5 0-6 1-8.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function GrainBowlGlyph({ className, color }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M4 12c0 4.4 3.6 8 8 8s8-3.6 8-8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3.5 12h17" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="9.5" r="0.9" fill={color} />
      <circle cx="13" cy="8.5" r="0.9" fill={color} />
      <circle cx="16" cy="10" r="0.9" fill={color} />
    </svg>
  );
}

function EggGlyph({ className, color }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <ellipse cx="12" cy="13" rx="7" ry="6.2" fill={color} opacity="0.4" />
      <circle cx="12" cy="12.5" r="3.4" fill={color} />
    </svg>
  );
}

function PotGlyph({ className, color }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M5 11h14l-1.2 7.5a2 2 0 0 1-2 1.5H8.2a2 2 0 0 1-2-1.5L5 11Z" fill={color} opacity="0.9" />
      <path d="M4.5 11h15" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3 8.5C4.5 6.8 6 6.8 7.5 8.5M9.5 8.5C11 6.8 12.5 6.8 14 8.5M16 8.5c1.5-1.7 3-1.7 4.5 0" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function BowlGlyph({ className, color }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M4.5 11.5h15" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 11.5c0 4.5 3.1 8 7 8s7-3.5 7-8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 4.5v3.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
