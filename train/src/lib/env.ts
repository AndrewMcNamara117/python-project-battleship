/**
 * Environment access, in one place.
 *
 * Anything read here on the server stays on the server. Only the two
 * NEXT_PUBLIC_ Supabase values are safe in a browser bundle — the anon key is
 * designed to be public and is useless without the RLS policies in
 * supabase/migrations/0002_rls.sql. The service-role key and Stripe secrets
 * are read lazily inside server-only modules so they can never be inlined
 * into client code.
 */

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True when a real database is configured. Drives adapter selection. */
export const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);

export function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function optionalServerEnv(name: string): string | null {
  return process.env[name] || null;
}

export const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY);

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
