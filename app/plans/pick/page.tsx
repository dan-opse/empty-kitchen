import { PickPlan } from "@/components/pick-plan";
import { isConfigured } from "@/lib/env";
import { loadCandidates } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function PickPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ generation?: string }>;
}) {
  const { generation } = await searchParams;
  if (!generation) {
    return <p className="text-muted">Missing generation. Confirm a grocery list first.</p>;
  }
  if (!isConfigured()) {
    return <p className="text-muted">Supabase is not configured.</p>;
  }
  const candidates = await loadCandidates(generation);
  if (candidates.length === 0) {
    return (
      <p className="text-muted">
        No feasible recipes for that haul. Import more recipes or add ingredients, then try again.
      </p>
    );
  }
  return <PickPlan candidates={candidates} />;
}
