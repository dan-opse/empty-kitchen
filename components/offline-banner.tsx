"use client";

import { useOffline } from "next/offline";

export function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;
  return (
    <div
      role="status"
      className="relative z-40 bg-teal px-4 py-2 text-center text-sm font-semibold text-white"
    >
      You are offline. This week is still readable if it was already loaded.
    </div>
  );
}
