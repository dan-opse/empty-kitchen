import { GeneratePlans } from "@/components/generate-plans";
import { listPantry } from "@/lib/catalog";
import { isConfigured } from "@/lib/env";
import { getActiveWeek, getLatestUnselectedGeneration } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function PlansPage() {
  if (!isConfigured()) {
    return <GeneratePlans configured={false} pantryEmpty />;
  }

  let pantryEmpty = true;
  let pendingGenerationId: string | null = null;
  let activeWeek = null;
  try {
    const [pantry, pending, active] = await Promise.all([
      listPantry(),
      getLatestUnselectedGeneration(),
      getActiveWeek(),
    ]);
    // Staples are assumed on hand; the kitchen is "empty" of real food when
    // there are no in-stock leftovers to cook from.
    pantryEmpty = !pantry.some((p) => p.kind === "leftover" && p.status === "in_stock");
    pendingGenerationId = pending?.generation_id ?? null;
    activeWeek = active;
  } catch (error) {
    console.error("[plans/page] load failed:", error);
    pantryEmpty = true;
  }

  return (
    <GeneratePlans
      configured
      pantryEmpty={pantryEmpty}
      pendingGenerationId={pendingGenerationId}
      activeWeek={activeWeek}
    />
  );
}
