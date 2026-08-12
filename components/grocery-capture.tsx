"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { captureGroceries } from "@/app/actions/groceries";

export function GroceryCapture() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  function submitFile(file: File | null | undefined, mode: string) {
    if (!file) return;
    const data = new FormData();
    data.set("mode", mode);
    data.set("file", file);
    start(async () => {
      setError(null);
      const result = await captureGroceries(data);
      if (!result.ok) setError(result.error);
      else router.push(`/groceries/confirm?receipt=${result.receiptId}`);
    });
  }

  function submitList() {
    const data = new FormData();
    data.set("mode", "manual");
    data.set("typed", typed);
    start(async () => {
      setError(null);
      const result = await captureGroceries(data);
      if (!result.ok) setError(result.error);
      else router.push(`/groceries/confirm?receipt=${result.receiptId}`);
    });
  }

  return (
    <div>
      <h1 className="font-display text-[2.15rem] font-semibold leading-none tracking-tight">Add groceries</h1>
      <p className="mt-3 max-w-md text-muted">
        Photo, library, or an iPhone document scan (PDF). If the file is unusable, type a short list.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <Choice
          label="Take photo"
          onClick={() => photoRef.current?.click()}
          icon={<CameraIcon />}
        />
        <Choice
          label="Choose photo"
          onClick={() => libraryRef.current?.click()}
          icon={<ImageIcon />}
        />
        <Choice label="Choose PDF" onClick={() => pdfRef.current?.click()} icon={<FileIcon />} />
        <Choice label="Type a list" onClick={() => setListOpen(true)} icon={<ListIcon />} />
      </div>

      <input
        ref={photoRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={(e) => submitFile(e.target.files?.[0], "image")}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => submitFile(e.target.files?.[0], "image")}
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => submitFile(e.target.files?.[0], "pdf")}
      />

      {listOpen ? (
        <div className="mt-6 rounded-[24px] bg-card p-4 shadow-[var(--shadow)]">
          <label htmlFor="typed" className="text-sm font-semibold">
            What did you buy?
          </label>
          <textarea
            id="typed"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="chicken, spinach, milk"
            className="mt-2 min-h-28 w-full rounded-2xl bg-canvas px-3 py-3 text-base"
          />
          <button
            type="button"
            onClick={submitList}
            disabled={pending}
            className="mt-3 w-full rounded-full bg-teal py-3 font-semibold text-white disabled:opacity-60"
          >
            Continue
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
      {pending ? (
        <div className="mt-6 rounded-[20px] bg-white/70 px-4 py-5 text-center font-semibold text-teal">
          Reading the list…
        </div>
      ) : null}
    </div>
  );
}

function Choice({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-[24px] bg-card p-4 shadow-[var(--shadow)]"
    >
      <span className="grid h-14 w-14 place-items-center rounded-full bg-teal-soft text-teal">{icon}</span>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 8h4l2-3h4l2 3h4v11H4V8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function ImageIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
      <path d="M6 17l5-5 8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function FileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 3h7l5 5v13H7V3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 7h12M8 12h12M8 17h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="4" cy="7" r="1.2" fill="currentColor" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" />
      <circle cx="4" cy="17" r="1.2" fill="currentColor" />
    </svg>
  );
}
