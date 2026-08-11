"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Modal } from "@/components/admin/ui/Modal";
import { Button, Spinner, fieldInput } from "@/components/admin/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Dashboard "Reset stats" control. Opens a modal that requires the admin to re-enter
 * their own login password, then POSTs to /api/admin/reset-stats (which re-verifies it
 * server-side and wipes orders, payments, customers and carts). Only rendered for users
 * with `backup:manage` — see the guard in app/admin/(panel)/page.tsx.
 */
export function ResetStatsButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reset-stats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; orders?: number; customers?: number };
      if (!res.ok) throw new Error(data.error || "Reset failed");
      toast.success(`Stats reset — ${data.orders ?? 0} order(s) and ${data.customers ?? 0} customer(s) cleared`);
      setOpen(false);
      setPassword("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RotateCcw size={14} /> Reset stats
      </Button>

      <Modal open={open} onClose={close} title="Reset dashboard stats" size="sm">
        <form onSubmit={submit} className="space-y-4">
          <div className="border border-danger/30 bg-danger/10 p-3 text-[13px] leading-relaxed">
            <p className="font-medium text-danger">This permanently deletes every order, payment, customer and cart.</p>
            <p className="mt-1 text-secondary">
              Your product catalog and staff accounts are kept. This cannot be undone.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.14em] text-faint">Confirm your password</span>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your admin password"
              autoComplete="current-password"
              className={cn(fieldInput, "rounded-[3px] bg-elevated")}
            />
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={busy || !password}>
              {busy && <Spinner />} Reset everything
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
