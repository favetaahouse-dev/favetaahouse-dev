"use client";

import { useState } from "react";
import Image from "next/image";
import { X, Plus, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/lib/i18n-navigation";
import { useCart } from "@/components/providers/cart-context";
import { Price } from "@/components/Price";
import { useCurrency } from "@/components/providers/currency-context";
import { variantLabel } from "@/lib/variant-options";

export function CartDrawer() {
  const t = useTranslations("cart");
  const { items, subtotal, discount, total, couponCode, count, open, setOpen, update, remove, applyCoupon, removeCoupon } =
    useCart();
  const { format } = useCurrency();
  const [code, setCode] = useState("");

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
      />
      <aside
        className={`fixed end-0 top-0 z-50 flex h-full w-full max-w-[420px] flex-col bg-paper shadow-xl transition-transform duration-500 ease-[cubic-bezier(0.24,0.25,0,1)] ${
          open ? "translate-x-0" : "ltr:translate-x-full rtl:-translate-x-full"
        }`}
        role="dialog"
        aria-label={t("title")}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-button text-sm uppercase tracking-[0.16em]">
            {t("title")} ({count})
          </h2>
          <button onClick={() => setOpen(false)} aria-label="Close">
            <X size={20} strokeWidth={1.5} />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
            <p className="text-sm text-muted">{t("empty")}</p>
            <p className="text-xs text-muted">{t("emptyMessage")}</p>
            <button onClick={() => setOpen(false)} className="btn-brand">
              {t("continueShopping")}
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.map((it) => (
                <div key={it.id} className="flex gap-4 border-b border-line py-4">
                  <Link
                    href={`/products/${it.handle}`}
                    onClick={() => setOpen(false)}
                    className="relative aspect-[4/5] w-20 shrink-0 bg-cream"
                  >
                    {it.image && (
                      <Image src={it.image} alt={it.title} fill sizes="80px" className="object-cover" />
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-2">
                      <Link
                        href={`/products/${it.handle}`}
                        onClick={() => setOpen(false)}
                        className="text-[13px] font-medium hover:text-gold"
                      >
                        {it.title}
                      </Link>
                      <button onClick={() => remove(it.id)} aria-label={t("remove")}>
                        <X size={15} className="text-muted hover:text-ink" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {variantLabel(it)}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center border border-line">
                        <button
                          className="px-2 py-1 disabled:opacity-30"
                          onClick={() => update(it.id, it.quantity - 1)}
                          aria-label="decrease"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="min-w-6 text-center text-xs">{it.quantity}</span>
                        <button
                          className="px-2 py-1 disabled:opacity-30"
                          onClick={() => update(it.id, it.quantity + 1)}
                          disabled={it.quantity >= it.maxStock}
                          aria-label="increase"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <span className="text-[13px]">{format(it.price * it.quantity)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <footer className="border-t border-line px-5 py-4">
              {/* promo code */}
              {couponCode ? (
                <div className="mb-3 flex items-center justify-between bg-cream px-3 py-2.5 text-xs">
                  <span className="badge text-gold">{couponCode}</span>
                  <button onClick={removeCoupon} className="text-muted hover:text-ink">
                    {t("remove")}
                  </button>
                </div>
              ) : (
                <div className="mb-3 flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder={t("promoPlaceholder")}
                    className="flex-1 border border-line px-3 py-2 text-xs uppercase tracking-wider outline-none focus:border-ink focus:shadow-[inset_0_-2px_0_var(--color-gold)]"
                  />
                  <button
                    onClick={async () => {
                      if (!code) return;
                      const ok = await applyCoupon(code);
                      if (ok) { toast.success(t("promoApplied")); setCode(""); }
                      else toast.error(t("promoInvalid"));
                    }}
                    className="border border-ink px-4 text-[11px] uppercase tracking-wider hover:bg-ink hover:text-white"
                  >
                    {t("apply")}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{t("subtotal")}</span>
                <span>{format(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between text-sm text-sale">
                  <span>{t("discount")}</span>
                  <span>− {format(discount)}</span>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between">
                <span className="font-button text-sm uppercase tracking-[0.14em]">{t("total")}</span>
                <Price cents={total} className="text-base" />
              </div>
              <p className="mt-1 text-[11px] text-muted">{t("taxesNote")}</p>
              <Link href="/checkout" onClick={() => setOpen(false)} className="btn-brand mt-4 w-full">
                {t("checkout")}
              </Link>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
