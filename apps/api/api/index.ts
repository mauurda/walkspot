// Vercel serverless entrypoint. vercel.json rewrites every route here, so this
// file is the whole production surface — src/server.ts is local dev only.
import { createApp } from "../src/app.js";

export default createApp();
