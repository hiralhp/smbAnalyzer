// ─────────────────────────────────────────────────────────────────────────────
// Supabase browser client (for client components)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

let _client: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createBrowserClient() {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  _client = createSupabaseClient<Database>(url, key);
  return _client;
}
