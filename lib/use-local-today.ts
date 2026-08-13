"use client";

import { useEffect, useState } from "react";
import { msUntilLocalMidnight, todayISO } from "@/lib/dates";

export function useLocalToday(): string {
  const [today, setToday] = useState(() => todayISO());

  useEffect(() => {
    let timeoutId = 0;

    function sync() {
      const next = todayISO();
      setToday((prev) => (prev === next ? prev : next));
    }

    function arm() {
      timeoutId = window.setTimeout(() => {
        sync();
        arm();
      }, msUntilLocalMidnight());
    }

    arm();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", sync);

    function onVisibility() {
      if (document.visibilityState === "visible") sync();
    }

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return today;
}
