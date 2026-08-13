import { purgeExpiredReceiptFiles } from "@/lib/receipts";
import { purgeOldPlanGenerations } from "@/lib/plans";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const receipts = await purgeExpiredReceiptFiles();
  const plans = await purgeOldPlanGenerations();
  return Response.json({ receipts, plans });
}

export async function POST(request: Request) {
  return GET(request);
}
