import { isConfigured } from "@/lib/env";
import { getActiveWeek } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isConfigured()) {
    return Response.json(null);
  }
  try {
    const week = await getActiveWeek();
    return Response.json(week);
  } catch {
    return Response.json(null, { status: 200 });
  }
}
