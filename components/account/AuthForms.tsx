"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/lib/i18n-navigation";
import { registerUser } from "@/lib/actions/auth";
import { requestEmailVerification, verifyEmail, checkEmailVerified } from "@/lib/actions/verification";

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
    if (!res?.error) {
      window.location.href = "./orders";
      return;
    }
    // A wrong password and an unverified account both fail the same way — disambiguate
    // so an unverified user is sent to finish verification instead of guessing.
    const { unverified } = await checkEmailVerified(email);
    setBusy(false);
    if (unverified) {
      window.location.href = `./verify?email=${encodeURIComponent(email)}`;
    } else {
      toast.error("Invalid email or password.");
    }
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
        <Link href="/account/register" className="text-signal hover:underline">
          {t("register")}
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm() {
  const t = useTranslations("account");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [step, setStep] = useState<"details" | "code">("details");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await registerUser(form);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error === "exists" ? "An account with this email already exists." : "Please check your details.");
      return;
    }
    setStep("code");
    toast.success(t("codeResent"));
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await verifyEmail(form.email, code);
    if (!res.ok) {
      setBusy(false);
      toast.error(
        res.error === "expired" ? t("expiredCode") : res.error === "too_many" ? t("tooManyAttempts") : t("invalidCode"),
      );
      return;
    }
    // Verified — sign in with the password still held in memory and go to the account.
    await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    window.location.href = "./orders";
  }

  async function resend() {
    await requestEmailVerification(form.email);
    toast.success(t("codeResent"));
  }

  if (step === "code") {
    return (
      <div className="mx-auto max-w-sm px-6 py-16">
        <h1 className="section-title mb-4">{t("verifyTitle")}</h1>
        <p className="mb-8 text-sm text-muted">{t("verifyIntro", { email: form.email })}</p>
        <form onSubmit={submitCode} className="flex flex-col gap-4">
          <Field
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder={t("code")}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
          />
          <button type="submit" disabled={busy || code.length !== 6} className="btn-brand w-full py-4">
            {t("verify")}
          </button>
        </form>
        <button onClick={resend} className="mt-6 w-full text-center text-sm text-signal hover:underline">
          {t("resendCode")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="section-title mb-8">{t("register")}</h1>
      <form onSubmit={submitDetails} className="flex flex-col gap-4">
        <Field placeholder={t("name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Field type="email" placeholder={t("email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <Field type="tel" placeholder={t("phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        <Field type="password" placeholder={t("password")} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
        <button type="submit" disabled={busy} className="btn-brand w-full py-4">
          {t("register")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/account/login" className="text-signal hover:underline">
          {t("login")}
        </Link>
      </p>
    </div>
  );
}

/** Standalone verify screen for users who left the signup flow before entering their code. */
export function VerifyForm({ initialEmail = "" }: { initialEmail?: string }) {
  const t = useTranslations("account");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await verifyEmail(email, code);
    setBusy(false);
    if (!res.ok) {
      toast.error(
        res.error === "expired" ? t("expiredCode") : res.error === "too_many" ? t("tooManyAttempts") : t("invalidCode"),
      );
      return;
    }
    toast.success(t("verifiedLogin"));
    window.location.href = "./login";
  }

  async function resend() {
    if (!email) return;
    await requestEmailVerification(email);
    toast.success(t("codeResent"));
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="section-title mb-4">{t("verifyTitle")}</h1>
      <p className="mb-8 text-sm text-muted">{t("verifyIntro", { email: email || "your email" })}</p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {!initialEmail && (
          <Field type="email" placeholder={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} required />
        )}
        <Field
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder={t("code")}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          required
        />
        <button type="submit" disabled={busy || code.length !== 6} className="btn-brand w-full py-4">
          {t("verify")}
        </button>
      </form>
      <button onClick={resend} className="mt-6 w-full text-center text-sm text-signal hover:underline">
        {t("resendCode")}
      </button>
    </div>
  );
}
