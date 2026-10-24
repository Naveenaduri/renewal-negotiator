// Server only. Builds a one-time sign-in link. Supabase makes the token; we email it ourselves
// through Primitive, so we know the address really belongs to the person signing in.
import { appUrl } from "./primitive";
import { supabaseAdmin } from "./supabase-admin";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Only allow in-app paths as a redirect target.
export function safeNext(next: unknown): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : "/new";
}

export async function createSignInLink(email: string, next: string): Promise<string> {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: "magiclink", email });
  const token = data?.properties?.hashed_token;
  // A brand-new account gets a "signup" token, an existing one a "magiclink" token. The link has to say which.
  const kind = data?.properties?.verification_type === "signup" ? "signup" : "magiclink";
  if (error || !token) throw new Error("Could not create a sign-in link");
  // Our own callback page redeems the token in the browser, so mail scanners that only GET the link cannot use it up.
  return `${appUrl()}/auth/callback?token_hash=${encodeURIComponent(token)}&type=${kind}&next=${encodeURIComponent(safeNext(next))}`;
}
