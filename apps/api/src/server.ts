// Local dev entrypoint. Production runs api/index.ts on Vercel instead.
import { createApp } from "./app.js";
import { env } from "./env.js";

createApp().listen(env.port, () => {
  console.log(`Walkspot API on http://localhost:${env.port}`);
});
