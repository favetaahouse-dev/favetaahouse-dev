"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/lib/i18n-navigation";
import { registerUser } from "@/lib/actions/auth";

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-ink"
    />
  );
}

export function LoginForm() {
  const t = useTranslations("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) toast.error("Invalid email or password.");
    else window.location.href = "./orders";
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="section-title mb-8">{t("login")}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field type="email" placeholder={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field type="password" placeholder={t("password")} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" disabled={busy} className="btn-brand w-full py-4">
          {t("login")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href="/account/register" className="text-gold hover:underline">
          {t("register")}
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm() {
  const t = useTranslations("account");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await registerUser(form);
    if (!res.ok) {
      setBusy(false);
      toast.error(res.error === "exists" ? "An account with this email already exists." : "Please check your details.");
      return;
    }
    await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    window.location.href = "./orders";
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="section-title mb-8">{t("register")}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field placeholder={t("name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Field type="email" placeholder={t("email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <Field type="password" placeholder={t("password")} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
        <button type="submit" disabled={busy} className="btn-brand w-full py-4">
          {t("register")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/account/login" className="text-gold hover:underline">
          {t("login")}
        </Link>
      </p>
    </div>
  );
}
