"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function Newsletter() {
  const t = useTranslations("home");
  const [email, setEmail] = useState("");

  return (
    <section className="bg-paper px-6 py-20">
      <div className="mx-auto max-w-xl text-center">
        <p className="eyebrow mb-3 text-signal">Alessia Abaya</p>
        <h2 className="section-title mb-3">{t("newsletter")}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!email) return;
            toast.success(t("newsletterSuccess"));
            setEmail("");
          }}
          className="mt-6 flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="field flex-1"
          />
          <button type="submit" className="btn-brand">
            {t("subscribe")}
          </button>
        </form>
      </div>
    </section>
  );
}
