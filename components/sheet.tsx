"use client";

import { useEffect } from "react";

export function Sheet({
  children,
  onClose,
  labelledBy,
  wide = false,
  nested = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy?: string;
  wide?: boolean;
  nested?: boolean;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={`fixed inset-0 ${nested ? "z-50" : "z-40"}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button
        type="button"
        className="sheet-backdrop absolute inset-0 bg-ink/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className={`sheet-panel absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[28px] bg-card p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:inset-auto md:bottom-8 md:right-8 md:rounded-[28px] ${
          wide ? "md:w-[32rem]" : "md:w-96"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
