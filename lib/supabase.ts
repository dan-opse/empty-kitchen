import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/env";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isConfigured()) {
    throw new Error("Supabase is not configured. Copy .env.example to .env.local.");
  }
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return cached;
}
