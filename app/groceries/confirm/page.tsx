import { ConfirmForm } from "@/components/confirm-form";
import { listIngredients, listPantry } from "@/lib/catalog";
import { isConfigured } from "@/lib/env";
import { getReceiptDraft } from "@/lib/receipts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ receipt?: string }>;
}) {
  const { receipt } = await searchParams;
  if (!receipt) {
    return <p className="text-muted">Missing receipt. Go back and add groceries.</p>;
  }
  if (!isConfigured()) {
    return <p className="text-muted">Supabase is not configured.</p>;
  }

  const [draft, pantry, ingredients] = await Promise.all([
    getReceiptDraft(receipt),
    listPantry(),
    listIngredients(),
  ]);

  return (
    <ConfirmForm
      receiptId={receipt}
      items={draft.items}
      pantry={pantry}
      ingredients={ingredients}
    />
  );
}
