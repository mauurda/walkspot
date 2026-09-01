/**
 * ui — the form and layout primitives every screen composes. Label above,
 * hint below, inline error, 44px targets. Nothing here knows about hunts.
 */
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Link } from "react-router";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-deep",
  secondary: "bg-brand-soft text-brand-deep hover:bg-brand-soft/70",
  ghost: "bg-transparent text-brand-deep hover:bg-brand-soft/60",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
};

export function Button({
  variant = "primary",
  busy,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold transition disabled:opacity-50",
        VARIANT[variant],
        className,
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = "primary", className, children }: { to: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={cx("inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold transition", VARIANT[variant], className)}>
      {children}
    </Link>
  );
}

type FieldProps = { label: string; hint?: string; error?: string | null; children: ReactNode; className?: string };

export function Field({ label, hint, error, children, className }: FieldProps) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {error ? <span className="mt-1.5 block text-sm text-danger">{error}</span> : hint ? <span className="mt-1.5 block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

const CONTROL = "block w-full rounded-md border border-hairline bg-paper-soft px-3.5 py-3 text-base text-ink outline-none placeholder:text-muted/70 focus:border-brand";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(CONTROL, className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(CONTROL, "min-h-24", className)} />;
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-11 w-full items-center gap-3 text-left">
      <span className={cx("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-brand" : "bg-hairline")}>
        <span className={cx("absolute top-1 size-5 rounded-full bg-white shadow transition", checked ? "left-6" : "left-1")} />
      </span>
      <span>
        <span className="block font-semibold">{label}</span>
        {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
      </span>
    </button>
  );
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={cx("block w-full rounded-lg border border-hairline bg-paper-soft p-4 text-left", onClick && "transition hover:border-brand", className)}>
      {children}
    </Tag>
  );
}

type Tone = "brand" | "accent" | "ok" | "danger" | "muted";
const TONE: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-deep",
  accent: "bg-accent-soft text-accent",
  ok: "bg-ok-soft text-ok",
  danger: "bg-danger-soft text-danger",
  muted: "bg-hairline/60 text-muted",
};

export function Pill({ tone = "muted", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", TONE[tone], className)}>{children}</span>;
}

export function Title({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cx("font-display text-3xl font-bold leading-tight text-brand-deep", className)}>{children}</h1>;
}

export function Heading({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("font-display text-xl font-semibold text-brand-deep", className)}>{children}</h2>;
}

export function Notice({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={cx("rounded-md px-3.5 py-3 text-sm", TONE[tone])}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-hairline px-4 py-8 text-center text-muted">{children}</p>;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted">
      <Loader2 className="size-5 animate-spin" /> {label}
    </div>
  );
}

/** Page shell: centred column, comfortable on a phone, not silly on a laptop. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx("mx-auto w-full max-w-2xl px-4 pb-28 pt-6", className)}>{children}</main>;
}

/** The api error (or anything thrown) as one line a person can read. */
export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

export function Media({ url, type, className }: { url: string | null; type: "image" | "video"; className?: string }) {
  if (!url) return <div className={cx("grid aspect-square place-items-center bg-hairline/40 text-sm text-muted", className)}>Media unavailable</div>;
  return type === "video" ? (
    <video src={url} controls playsInline preload="metadata" className={cx("w-full bg-black", className)} />
  ) : (
    <img src={url} alt="" loading="lazy" className={cx("w-full object-cover", className)} />
  );
}
