"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { X, Plus, Minus, Truck, PackageCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/lib/i18n-navigation";
import { Price } from "@/components/Price";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { ProductAccordion } from "@/components/product/ProductAccordion";
import { useCart } from "@/components/providers/cart-context";
import { cn } from "@/lib/utils";

export type VariantDTO = {
  id: string;
  color: string;
  colorHex: string | null;
  size: string;
  sku: string | null;
  price: number;
  compareAt: number | null;
  stock: number;
  available: boolean;
  imageUrl: string | null;
};

export type ProductDetailDTO = {
  handle: string;
  title: string;
  category: string;
  productCode: string | null;
  description: string | null;
  materials: string | null;
  modelSize: string | null;
  details: string | null;
  packaging: string | null;
  images: { url: string; alt: string | null }[];
  variants: VariantDTO[];
};

export function ProductDetail({ product }: { product: ProductDetailDTO }) {
  const t = useTranslations("product");
  const router = useRouter();
  const { add } = useCart();

  const colors = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const v of product.variants) if (!map.has(v.color)) map.set(v.color, v.colorHex);
    return [...map.entries()].map(([color, hex]) => ({ color, hex }));
  }, [product.variants]);

  const [color, setColor] = useState(colors[0]?.color ?? "");
  const sizesForColor = product.variants.filter((v) => v.color === color);
  const firstAvailable = sizesForColor.find((v) => v.available && v.stock > 0) ?? sizesForColor[0];
  const [size, setSize] = useState(firstAvailable?.size ?? "");
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [adding, setAdding] = useState(false);

  const selected =
    product.variants.find((v) => v.color === color && v.size === size) ?? firstAvailable;
  const allSoldOut =
    product.variants.length > 0 && product.variants.every((v) => !v.available || v.stock < 1);

  function selectColor(c: string) {
    setColor(c);
    const vs = product.variants.filter((v) => v.color === c);
    const avail = vs.find((v) => v.available && v.stock > 0) ?? vs[0];
    setSize(avail?.size ?? "");
    if (avail?.imageUrl) {
      const idx = product.images.findIndex((im) => im.url === avail.imageUrl);
      if (idx >= 0) setActiveImg(idx);
    }
  }

  async function handleAdd(buyNow = false) {
    if (!selected) return;
    if (!size) {
      toast.error(t("selectSize"));
      return;
    }
    if (!selected.available || selected.stock < 1) {
      toast.error(t("outOfStock"));
      return;
    }
    setAdding(true);
    const ok = await add(selected.id, qty);
    setAdding(false);
    if (ok && buyNow) router.push("/checkout");
    if (!ok) toast.error(t("outOfStock"));
  }

  const images = product.images.length ? product.images : [{ url: "", alt: product.title }];

  return (
    <div className="px-4 py-8 md:px-8 lg:py-12">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-14">
        {/* Gallery */}
        <div className="flex flex-col-reverse gap-3 lg:flex-row lg:items-start">
          <div className="flex gap-2 overflow-x-auto lg:max-h-[640px] lg:flex-col lg:overflow-y-auto no-scrollbar">
            {images.map((im, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className={cn(
                  "relative aspect-[4/5] w-16 shrink-0 bg-cream lg:w-[74px]",
                  i === activeImg ? "ring-1 ring-ink" : "opacity-70",
                )}
              >
                {im.url && <Image src={im.url} alt="" fill sizes="74px" className="object-cover" />}
              </button>
            ))}
          </div>
          <div
            className="relative aspect-[4/5] w-full min-w-0 flex-1 cursor-zoom-in bg-cream"
            onClick={() => setLightbox(true)}
          >
            {images[activeImg]?.url && (
              <Image
                src={images[activeImg].url}
                alt={product.title}
                fill
                priority
                sizes="(max-width:1024px) 100vw, 45vw"
                className="object-cover"
              />
            )}
          </div>
        </div>

        {/* Info */}
        <div className="lg:max-w-md">
          {product.category && <p className="eyebrow mb-2.5 text-gold">{product.category}</p>}
          <h1 className="display text-[1.9rem] lg:text-[2.3rem]">{product.title}</h1>
          <div className="mt-3 text-lg">
            {selected && <Price cents={selected.price} compareAt={selected.compareAt} />}
          </div>
          {selected?.sku && (
            <p className="mt-1 text-xs text-muted">
              {t("sku")}: {selected.sku}
            </p>
          )}

          {/* Colors */}
          {colors.length > 0 && (
            <div className="mt-7">
              <p className="mb-2 font-button text-[11px] uppercase tracking-[0.14em]">
                {t("color")}: <span className="text-muted">{color}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c.color}
                    onClick={() => selectColor(c.color)}
                    title={c.color}
                    className={cn(
                      "h-8 w-8 border transition-all",
                      color === c.color ? "ring-1 ring-ink ring-offset-2" : "border-line",
                    )}
                    style={{ backgroundColor: c.hex ?? "#ccc" }}
                  />
                ))}
              </div>
            </div>
          )}

          {allSoldOut && (
            <p className="mt-5 border border-line bg-cream px-3 py-2 text-center text-[12px] uppercase tracking-[0.16em] text-muted">
              {t("soldOut")}
            </p>
          )}

          {/* Sizes */}
          <div className="mt-6">
            <p className="mb-2 font-button text-[11px] uppercase tracking-[0.14em]">{t("size")}</p>
            <div className="flex flex-wrap gap-2">
              {sizesForColor.map((v) => {
                const disabled = !v.available || v.stock < 1;
                return (
                  <button
                    key={v.id}
                    disabled={disabled}
                    onClick={() => setSize(v.size)}
                    className={cn(
                      "min-w-12 border px-4 py-2.5 text-xs uppercase tracking-wider transition-colors",
                      size === v.size ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                      disabled && "cursor-not-allowed border-line/60 text-muted line-through opacity-50",
                    )}
                  >
                    {v.size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity + actions */}
          <div className="mt-7 flex items-center gap-4">
            <div className="flex items-center border border-ink">
              <button className="px-3 py-3" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="decrease">
                <Minus size={14} />
              </button>
              <span className="min-w-8 text-center text-sm">{qty}</span>
              <button
                className="px-3 py-3"
                onClick={() => setQty((q) => Math.min(selected?.stock ?? 1, q + 1))}
                aria-label="increase"
              >
                <Plus size={14} />
              </button>
            </div>
            <WishlistButton handle={product.handle} className="h-12 w-12 border border-ink" />
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <button onClick={() => handleAdd(false)} disabled={adding} className="btn-outline w-full py-4">
              {t("addToCart")}
            </button>
            <button onClick={() => handleAdd(true)} disabled={adding} className="btn-brand w-full py-4">
              {t("buyNow")}
            </button>
          </div>

          <div className="mt-6 space-y-2 border-y border-line py-4 text-xs text-muted">
            <p className="flex items-center gap-2">
              <PackageCheck size={15} /> {t("freeShipping")}
            </p>
            <p className="flex items-center gap-2">
              <Truck size={15} /> {t("delivery")}
            </p>
          </div>

          <ProductAccordion product={product} />
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(false)}
        >
          <button className="absolute end-6 top-6 text-white" aria-label="Close">
            <X size={28} />
          </button>
          <div className="relative h-[85vh] w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {images[activeImg]?.url && (
              <Image src={images[activeImg].url} alt={product.title} fill className="object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
