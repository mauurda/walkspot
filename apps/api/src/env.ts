import "dotenv/config"; // loads apps/api/.env; a no-op on Vercel, where env comes from the dashboard

/**
 * Fail fast on a missing secret. A server that boots without SUPABASE_URL and
 * then 500s on the first request costs more to diagnose than one that refuses
 * to start and says which variable is absent.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),

  /** OSRM-compatible base URL for walking geometry; empty disables it. */
  routingUrl: optional("ROUTING_URL", "https://routing.openstreetmap.de/routed-foot").replace(/\/$/, ""),

  port: Number(optional("PORT", "4000")),
};
