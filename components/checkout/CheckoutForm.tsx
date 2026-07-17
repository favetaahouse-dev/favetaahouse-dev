"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCart } from "@/components/providers/cart-context";
import { Price } from "@/components/Price";
import { createCheckout } from "@/lib/actions/checkout";
import { variantLabel } from "@/lib/variant-options";

export function CheckoutForm({
  userEmail,
  shippingFee = 0,
  freeShippingThreshold = 0,
  taxRate = 0,
  taxLabel = "Tax",
}: {
  userEmail?: string;
  shippingFee?: number;
  freeShippingThreshold?: number;
  taxRate?: number;
  taxLabel?: string;
}) {
  const t = useTranslations("checkout");
  const tc = useTranslations("cart");
  const locale = useLocale();
  const { items, subtotal, discount, couponCode } = useCart();
  const [busy, setBusy] = useState(false);

  // Mirrors the authoritative shipping/tax math in the create_order RPC (QAR minor units).
  const netCents = Math.max(subtotal - discount, 0);
  const shippingCents =
    freeShippingThreshold > 0 && netCents >= freeShippingThreshold * 100 ? 0 : Math.round(shippingFee * 100);
  const taxCents = Math.round((netCents * taxRate) / 100);
  const grandTotal = netCents + shippingCents + taxCents;
  const [form, setForm] = useState({
    email: userEmail ?? "",
    fullName: "",
    address: "",
    address2: "",
    city: "",
    country: "Qatar",
    phone: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createCheckout({ ...form, locale });
    if (res.ok && res.url) {
      window.location.href = res.url;
    } else {
      setBusy(false);
      toast.error(res.error === "stock" ? "Some items are out of stock." : "Something went wrong.");
    }
  }

  if (items.length === 0) {
    return <p className="py-24 text-center text-sm text-muted">{tc("empty")}</p>;
  }

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 px-4 py-12 md:grid-cols-2 md:px-8">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2 className="font-button text-sm uppercase tracking-[0.16em]">{t("contact")}</h2>
        <Field placeholder={t("email")} type="email" value={form.email} onChange={set("email")} required />
        <h2 className="mt-4 font-button text-sm uppercase tracking-[0.16em]">{t("shipping")}</h2>
        <Field placeholder={t("fullName")} value={form.fullName} onChange={set("fullName")} required />
        <Field placeholder={t("address")} value={form.address} onChange={set("address")} required />
        <Field placeholder={t("address2")} value={form.address2} onChange={set("address2")} />
        <div className="grid grid-cols-2 gap-4">
          <Field placeholder={t("city")} value={form.city} onChange={set("city")} required />
          <Field placeholder={t("country")} value={form.country} onChange={set("country")} required />
        </div>
        <Field placeholder={t("phone")} value={form.phone} onChange={set("phone")} required />
        <button type="submit" disabled={busy} className="btn-brand mt-4 w-full py-4">
          {busy ? t("processing") : t("payNow")}
        </button>
      </form>

      <div className="order-first bg-cream p-6 md:order-last">
        <h2 className="mb-4 font-button text-sm uppercase tracking-[0.16em]">{t("orderSummary")}</h2>
        <div className="space-y-4">
          {items.map((it) => (
            <div key={it.id} className="flex gap-3">
              <div className="relative aspect-[4/5] w-16 shrink-0 bg-paper">
                {it.image && <Image src={it.image} alt={it.title} fill sizes="64px" className="object-cover" />}
                <span className="absolute -end-2 -top-2 flex h-5 w-5 items-center justify-center bg-ink text-[10px] text-white">
                  {it.quantity}
                </span>
              </div>
              <div className="flex flex-1 flex-col justify-center">
                <p className="text-[13px]">{it.title}</p>
                <p className="text-xs text-muted">
                  {variantLabel(it)}
                </p>
              </div>
              <div className="self-center text-[13px]">
                <Price cents={it.price * it.quantity} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-1.5 border-t border-line pt-4 text-sm">
          <div className="flex items-center justify-between text-muted">
            <span>{tc("subtotal")}</span>
            <span>{new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(subtotal / 100)} QAR</span>
          </div>
          {discount > 0 && (
            <div className="flex items-center justify-between text-sale">
              <span>{tc("discount")}{couponCode ? ` (${couponCode})` : ""}</span>
              <span>− {new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(discount / 100)} QAR</span>
            </div>
          )}
          <div className="flex items-center justify-between text-muted">
            <span>{locale === "ar" ? "الشحن" : "Shipping"}</span>
            {shippingCents > 0 ? (
              <Price cents={shippingCents} />
            ) : (
              <span>{locale === "ar" ? "مجاني" : "Free"}</span>
            )}
          </div>
          {taxCents > 0 && (
            <div className="flex items-center justify-between text-muted">
              <span>{taxLabel}</span>
              <Price cents={taxCents} />
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="font-button uppercase tracking-[0.14em]">{tc("total")}</span>
            <Price cents={grandTotal} className="text-base" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="field" />;
}
