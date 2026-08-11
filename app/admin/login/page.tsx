"use client";

import { Suspense, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { isStaff, type Access } from "@/lib/rbac/access";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setErr("Invalid email or password.");
      setBusy(false);
      return;
    }
    const session = await getSession();
    const u = session?.user as Partial<Access> | undefined;
    if (!isStaff({ role: u?.role ?? "", roleRank: u?.roleRank ?? 0, permissions: u?.permissions ?? [] })) {
      setErr("This account is not an administrator.");
      setBusy(false);
      return;
    }
    // Only honour a same-origin relative path — never an attacker-supplied absolute/off-site URL.
    // Require a leading "/" NOT followed by "/" or "\" (a browser resolves "/\evil.com" and
    // "//evil.com" as protocol-relative → off-site), so a crafted `from` can't open-redirect.
    const from = sp.get("from");
    const dest = from && /^\/[^/\\]/.test(from) ? from : "/admin";
    router.push(dest);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#141414] px-6 text-[#ececec]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-button text-lg uppercase tracking-[0.24em]">FAVETAA</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-signal">Admin Panel</div>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            type="text"
            autoComplete="username"
            required
            placeholder="Email or username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-white/15 bg-transparent px-4 py-3 text-sm outline-none focus:border-signal"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-white/15 bg-transparent px-4 py-3 text-sm outline-none focus:border-signal"
          />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 bg-signal py-3 font-button text-xs uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
