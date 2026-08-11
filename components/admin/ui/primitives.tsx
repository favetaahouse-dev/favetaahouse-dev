import type { ButtonHTMLAttributes, ReactNode } from "react";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { cn } from "@/lib/utils";

/* Shared (server + client) presentational primitives for the admin console.
   All colors use the semantic theme tokens (bg-surface, text-foreground, …). */

/**
 * The one class every admin form field wears.
 *
 * It used to be a string copy-pasted into eight files, which is how the copies drifted — one
 * grew a width, one lost its placeholder rule, one gained a background. Two things changed
 * when they were consolidated here:
 *
 * `border-field` instead of `border-edge`. Edge is a 14% wash (~1.3:1) that is right for panel
 * outlines and wrong for a control: an input drawn in it has no visible boundary at all, so a
 * form reads as a column of captions with values floating under them. See --admin-field.
 *
 * A real focus ring. This carried `outline-none` with nothing but `focus:border-accent/60` to
 * replace it — a colour change on a border you could not see — while Button in this same file
 * has always shipped `focus-visible:ring-2`. Both `focus:` and `focus-visible:` are set on
 * purpose: Chrome does not match :focus-visible on a mouse-clicked <select>, so the plain
 * `focus:` border is what keeps the Status dropdown from losing all mouse feedback.
 *
 * Deliberately NOT here: any `read-only:` variant. Per the selectors spec `:read-only` matches
 * <select> unconditionally, so it would permanently grey every dropdown in the console. Style
 * read-only inputs at their own call site.
 */
export const fieldInput =
  "w-full border border-field bg-canvas px-3 py-2 text-[13px] text-foreground transition-colors " +
  "placeholder:text-faint hover:border-accent/50 " +
  "focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("border border-edge bg-surface", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  badge,
  actions,
}: {
  title: string;
  description?: string;
  /** Sits beside the title — for the one fact that outranks the description. */
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-medium tracking-[0.02em] text-foreground">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 text-sm text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * A panel's own title bar — the level that was missing.
 *
 * SectionLabel below is the console's only label primitive, and it ended up doing five jobs:
 * panel title, sub-section heading, field label and table column header, all at the same 10px
 * faint uppercase. A screen where every level renders identically has no levels. This is the
 * top of that ladder — an actual <h2>, at a size you can read, in the foreground colour — and
 * it deliberately does NOT match SectionLabel, because looking different is the entire point.
 *
 * Flush header strip rather than an inline heading, matching settings/RolePermissionMatrix:
 * the border is what makes a panel's title read as a title rather than as its first row.
 */
export function PanelHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-edge px-5 py-3.5">
      <div>
        <h2 className="text-[13px] font-medium tracking-[0.02em] text-foreground">{title}</h2>
        {description && <p className="mt-1 max-w-prose text-[12px] leading-relaxed text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** One rung below PanelHeader: a group inside a panel. `step` numbers it when the groups are a sequence. */
export function SubsectionHeader({
  step,
  title,
  description,
}: {
  step?: number;
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="mb-2.5">
      <h3 className="flex items-center gap-2 text-[12px] font-medium text-foreground">
        {step !== undefined && (
          <span
            aria-hidden="true"
            className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-elevated text-[10px] font-medium text-secondary"
          >
            {step}
          </span>
        )}
        {title}
      </h3>
      {description && <p className="mt-1 max-w-prose text-[12px] leading-relaxed text-secondary">{description}</p>}
    </div>
  );
}

/**
 * A field's label. Distinct from SectionLabel in the two ways that matter:
 *
 * It renders a <span>. SectionLabel renders a <p>, and every form in the console nests it
 * inside a <label> — whose content model is phrasing content, so a <p> in there is invalid
 * HTML, and is why those labels all need `className="block"` to lay out at all.
 *
 * It is text-secondary, not text-faint. --admin-faint measures 3.09:1 (light) and 3.98:1
 * (dark) against bg-elevated, so a 10-11px label written in it fails AA in BOTH themes.
 * Secondary is 4.99 / 6.58 at worst.
 */
export function FieldLabel({
  children,
  required,
  hint,
  className,
}: {
  children: ReactNode;
  required?: boolean;
  /** Format rules and caveats. Lives here rather than in a placeholder, which vanishes on the first keystroke. */
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("mb-1.5 block", className)}>
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-secondary">
        {children}
        {required && <span aria-hidden="true" className="ms-1 text-danger">*</span>}
      </span>
      {hint && <span className="mt-0.5 block text-[11px] font-normal normal-case tracking-normal text-secondary">{hint}</span>}
    </span>
  );
}

export function Toolbar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 border-b border-edge bg-surface p-3", className)}>
      {children}
    </div>
  );
}

/**
 * The console's original label. Kept byte-identical because 44 call sites across eight pages
 * depend on it, and outside the product editor it is used exclusively as a panel/section title
 * — so any change to make it a better FIELD label would regress it as a title, and vice versa.
 *
 * New work should reach for PanelHeader (panel title), SubsectionHeader (group inside a panel)
 * or FieldLabel (a field) instead. This is now the eyebrow/kicker, and nothing else.
 */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[10px] uppercase tracking-[0.16em] text-faint", className)}>{children}</p>
  );
}

type ButtonVariant = "primary" | "default" | "outline" | "ghost" | "danger";
const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:opacity-90",
  default: "bg-elevated text-foreground border border-edge hover:border-accent/60",
  outline: "border border-edge text-foreground hover:bg-elevated",
  ghost: "text-secondary hover:bg-elevated hover:text-foreground",
  danger: "bg-danger text-white hover:opacity-90",
};

export function Button({
  variant = "default",
  size = "md",
  className,
  children,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: "sm" | "md";
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[3px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-[13px]",
        BTN_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  className,
  children,
  ...rest
}: { children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-[3px] text-secondary transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export type Tone = "neutral" | "accent" | "positive" | "warn" | "danger" | "info";
const TONES: Record<Tone, string> = {
  neutral: "bg-elevated text-secondary",
  accent: "bg-accent/15 text-accent",
  positive: "bg-positive/15 text-positive",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/15 text-danger",
  info: "bg-info/15 text-info",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[3px] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  PENDING: "warn", PAID: "positive", FULFILLED: "info", CANCELLED: "neutral", REFUNDED: "danger",
  active: "positive", draft: "warn", archived: "neutral",
  new: "warn", paid: "positive", failed: "danger", cancelled: "neutral",
  approved: "positive", rejected: "danger", pending: "warn",
};
export function StatusPill({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status}</Badge>;
}

export function Money({ cents, currency = "QAR" }: { cents: number; currency?: CurrencyCode }) {
  return <span className="tabular-nums">{formatMoney(cents, currency)}</span>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-elevated", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
