import type { ButtonHTMLAttributes, ReactNode } from "react";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { cn } from "@/lib/utils";

/* Shared (server + client) presentational primitives for the admin console.
   All colors use the semantic theme tokens (bg-surface, text-foreground, …). */

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("border border-edge bg-surface", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-medium tracking-[0.02em] text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Toolbar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 border-b border-edge bg-surface p-3", className)}>
      {children}
    </div>
  );
}

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
