/**
 * env.ts — the server's secrets, read lazily. Next evaluates modules at build
 * time while collecting routes, and a build box has no SUPABASE_URL; reading
 * on first use keeps "missing variable" an error of the first request that
 * needs it, with the variable's name, rather than of the build.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  get supabaseUrl(): string {
    return required("SUPABASE_URL");
  },
  get supabaseServiceRoleKey(): string {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  /** OSRM-compatible base URL for walking geometry; empty disables it. */
  get routingUrl(): string {
    return (process.env.ROUTING_URL ?? "https://routing.openstreetmap.de/routed-foot").replace(/\/$/, "");
  },
};
