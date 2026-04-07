import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Called daily by Vercel Cron to keep the Supabase project from pausing.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron (not a random caller)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient();
    // Lightweight query — just checks connectivity, reads nothing sensitive
    const { error } = await supabase
      .from("businesses")
      .select("id")
      .limit(1);

    if (error) throw error;

    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
