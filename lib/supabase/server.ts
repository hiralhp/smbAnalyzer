// ─────────────────────────────────────────────────────────────────────────────
// Supabase server-side client (for API routes and server components)
// Uses the service role key for pipeline operations, anon key for reads
// ─────────────────────────────────────────────────────────────────────────────

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Server-side Supabase client — uses service role for writes */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase URL and key are required. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  // Catch un-edited placeholder values from .env.example
  if (url.includes("your-project") || url === "https://your-project.supabase.co") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is still set to the placeholder value. " +
      "Go to supabase.com → your project → Settings → API and copy your real project URL."
    );
  }
  if (key.startsWith("your-") || key === "your-anon-key" || key === "your-service-role-key") {
    throw new Error(
      "Supabase API key is still set to the placeholder value. " +
      "Go to supabase.com → your project → Settings → API and copy your real anon/service key."
    );
  }

  return createSupabaseClient<Database>(url, key);
}
