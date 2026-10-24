import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser client: anon key, user session (anonymous or magic link). RLS applies.
let browser: SupabaseClient | null = null;
export function supabaseBrowser(): SupabaseClient {
  browser ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return browser;
}

// Guarantees a session, creating an anonymous one if needed. Returns the access token.
export async function ensureSession(): Promise<string> {
  const sb = supabaseBrowser();
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session.access_token;
  const { data: anon, error } = await sb.auth.signInAnonymously();
  if (error || !anon.session) {
    console.error("Guest session failed:", error);
    throw new Error(`Could not start a guest session${error?.message ? ` (${error.message})` : ""}. Please try again.`);
  }
  return anon.session.access_token;
}
