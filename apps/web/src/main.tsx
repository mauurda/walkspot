import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import * as Sentry from "@sentry/react";
import "./styles.css";
import { App } from "./App";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
Sentry.init({
  dsn,
  enabled: Boolean(dsn), // no DSN = local dev — run silently without Sentry
  environment: import.meta.env.MODE,
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
