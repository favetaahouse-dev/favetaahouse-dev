"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button, IconButton, Spinner } from "./primitives";
import { cn } from "@/lib/utils";

const noop = () => () => {};
/** false during SSR + first client render, true after mount (portal-safe, no effect setState). */
function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

function useEscape(onClose: () => void, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
}

const SIZES = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

function themeAttr(): string | undefined {
  return document.querySelector(".admin-theme")?.getAttribute("data-theme") ?? undefined;
}

export function Modal({
  open, onClose, title, children, footer, size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZES;
}) {
  const mounted = useMounted();
  useEscape(onClose, open);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="admin-theme fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:p-8" data-theme={themeAttr()}>
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className={cn("relative z-10 my-auto w-full border border-edge bg-surface text-foreground shadow-2xl", SIZES[size])}>
        {title && (
          <div className="flex items-center justify-between border-b border-edge px-5 py-3.5">
            <h2 className="text-sm font-medium tracking-[0.02em]">{title}</h2>
            <IconButton onClick={onClose} aria-label="Close"><X size={16} /></IconButton>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-edge px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open, onClose, title, children, footer, width = "w-full max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const mounted = useMounted();
  useEscape(onClose, open);
  if (!mounted) return null;
  return createPortal(
    <div className={cn("admin-theme fixed inset-0 z-[100]", open ? "" : "pointer-events-none")} data-theme={themeAttr()}>
      <div className={cn("fixed inset-0 bg-black/60 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <div className={cn("fixed inset-y-0 end-0 flex flex-col border-s border-edge bg-surface text-foreground shadow-2xl transition-transform", width, open ? "translate-x-0" : "ltr:translate-x-full rtl:-translate-x-full")}>
        {title && (
          <div className="flex items-center justify-between border-b border-edge px-5 py-3.5">
            <h2 className="text-sm font-medium">{title}</h2>
            <IconButton onClick={onClose} aria-label="Close"><X size={16} /></IconButton>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-edge px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title = "Are you sure?", body, confirmLabel = "Confirm", danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={run} disabled={busy}>
            {busy && <Spinner />} {confirmLabel}
          </Button>
        </>
      }
    >
      {body && <div className="text-sm text-secondary">{body}</div>}
    </Modal>
  );
}
