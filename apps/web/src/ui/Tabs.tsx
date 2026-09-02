"use client";
/** The bottom tab bar both shells use; the active tab is the current path. */
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from ".";

export type Tab = { to: string; label: string; icon: LucideIcon };

export function Tabs({ base, tabs }: { base: string; tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[500] border-t border-hairline bg-paper-soft pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const href = t.to ? `${base}/${t.to}` : base;
          // The index tab is active on the base path and its non-tab children (a challenge detail).
          const active = t.to ? pathname.startsWith(href) : pathname === base || !tabs.some((o) => o.to && pathname.startsWith(`${base}/${o.to}`));
          return (
            <Link key={t.to} href={href} className={cx("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", active ? "text-brand-deep" : "text-muted")}>
              <t.icon className="size-5" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
