import { KitchenList } from "@/components/kitchen-list";
import { ensureStapleRows, listPantry } from "@/lib/catalog";
import { isConfigured } from "@/lib/env";
import { splitPantry } from "@/lib/pantry";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  if (!isConfigured()) {
    return <p className="text-muted">Add Supabase keys to manage pantry state.</p>;
  }

  await ensureStapleRows();
  const pantry = await listPantry();
  const { leftovers, staples } = splitPantry(pantry);
  return <KitchenList leftovers={leftovers} staples={staples} />;
}
