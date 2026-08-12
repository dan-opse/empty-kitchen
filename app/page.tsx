import { EmptyWeek, WeekView } from "@/components/week-view";
import { recipeCount } from "@/lib/catalog";
import { isConfigured } from "@/lib/env";
import { getActiveWeek, getLatestUnselectedGeneration } from "@/lib/plans";
import type { ActiveWeek } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isConfigured()) {
    return <EmptyWeek recipeCount={0} configured={false} />;
  }

  let week: ActiveWeek | null = null;
  let pendingId: string | null = null;
  let count = 0;
  let loaded = false;
  try {
    const [active, pending, recipes] = await Promise.all([
      getActiveWeek(),
      getLatestUnselectedGeneration(),
      recipeCount(),
    ]);
    week = active;
    pendingId = pending?.generation_id ?? null;
    count = recipes;
    loaded = true;
  } catch {
    loaded = false;
  }

  if (!loaded) {
    return <EmptyWeek recipeCount={0} configured={false} />;
  }
  if (week) {
    return <WeekView week={week} />;
  }
  return <EmptyWeek pendingGenerationId={pendingId} recipeCount={count} configured />;
}
