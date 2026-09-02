import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Route handlers are the API: every one is per-request (bearer token,
  // body), so nothing under /api is ever prerendered. Declared per route.
};

export default config;
