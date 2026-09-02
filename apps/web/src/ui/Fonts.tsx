"use client";
/**
 * Fonts — the display and body faces, loaded AFTER hydration.
 *
 * A stylesheet <link> in <head> is render-blocking, and every script after
 * it waits for it: with the font host slow or unreachable the page paints
 * but never hydrates, and a screen that looks fine does nothing. Injecting
 * the link from an effect means the app is interactive on the system stack
 * and the brand faces swap in when they arrive (`display=swap`).
 */
import { useEffect } from "react";

const HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap";

export function Fonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = HREF;
    document.head.appendChild(link);
  }, []);
  return null;
}
