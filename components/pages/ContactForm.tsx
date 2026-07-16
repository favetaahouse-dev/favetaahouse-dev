"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { WHATSAPP_URL } from "@/lib/constants";

export function ContactForm() {
  const t = useTranslations("contact");
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSending(true);
        await new Promise((r) => setTimeout(r, 500));
        setSending(false);
        toast.success(t("success"));
        setForm({ name: "", email: "", message: "" });
      }}
      className="mx-auto flex max-w-xl flex-col gap-4"
    >
      <input
        required
        placeholder={t("name")}
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-ink"
      />
      <input
        required
        type="email"
        placeholder={t("email")}
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-ink"
      />
      <textarea
        required
        rows={5}
        placeholder={t("message")}
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        className="border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-ink"
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={sending} className="btn-brand flex-1">
          {t("send")}
        </button>
        <a href={WHATSAPP_URL} target="_blank" rel="noopener" className="btn-outline flex-1">
          {t("whatsapp")}
        </a>
      </div>
    </form>
  );
}
