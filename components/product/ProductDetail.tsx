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
import { sortSizes } from "@/lib/variant-options";
import { cn } from "@/lib/utils";

// A variant is one colour+size, holding stock. Length + tack-tack are made-to-order choices
// captured on the cart line, not stocked separately.
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
  lengths: number[]; // offered lengths (from the CMS list); made-to-order choices
};

const stocked = (v: VariantDTO) => v.available && v.stock > 0;
const firstStocked = (list: VariantDTO[]) => list.find(stocked) ?? list[0];

export function ProductDetail({ product }: { product: ProductDetailDTO }) {
  const t = useTranslations("product");
  const router = useRouter();
  const { add } = useCart();
  const variants = product.variants;

  const colors = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const v of variants) if (!map.has(v.color)) map.set(v.color, v.colorHex);
    return [...map.entries()].map(([color, hex]) => ({ color, hex }));
  }, [variants]);

  const firstColor = colors[0]?.color ?? "";
  const firstSize = firstStocked(variants.filter((v) => v.color === firstColor))?.size ?? "";
  const lengths = product.lengths;

  const [color, setColor] = useState(firstColor);
  const [size, setSize] = useState(firstSize);
  const [tackTack, setTackTack] = useState(false); // "No" by default
  const [length, setLength] = useState<number | null>(lengths[0] ?? null);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [adding, setAdding] = useState(false);

  const inColor = variants.filter((v) => v.color === color);
  const sizes = useMemo(() => sortSizes([...new Set(inColor.map((v) => v.size))]), [inColor]);

  // Stock lives on (colour, size). Tack-tack + length are always-available made-to-order choices.
  const selected = variants.find((v) => v.color === color && v.size === size);
  const allSoldOut = variants.length > 0 && variants.every((v) => !stocked(v));
  const sizeSoldOut = (s: string) => !inColor.some((v) => v.size === s && stocked(v));

  function jumpGallery(v?: VariantDTO) {
    if (v?.imageUrl) {
      const idx = product.images.findIndex((im) => im.url === v.imageUrl);
      if (idx >= 0) setActiveImg(idx);
    }
  }

  function selectColor(c: string) {
    const inC = variants.filter((v) => v.color === c);
    const s = firstStocked(inC)?.size ?? inC[0]?.size ?? "";
    setColor(c);
    setSize(s);
    jumpGallery(inC.find((v) => v.size === s));
  }

  async function handleAdd(buyNow = false) {
    if (!selected) {
      toast.error(t("selectSize"));
      return;
    }
    if (!stocked(selected)) {
      toast.error(t("outOfStock"));
      return;
    }
    if (lengths.length > 0 && length == null) {
      toast.error(t("selectLength"));
      return;
    }
    setAdding(true);
    const ok = await add(selected.id, qty, length ?? undefined, tackTack);
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
                  "relative aspect-[4/5] w-16 shrink-0 bg-mist lg:w-[74px]",
                  i === activeImg ? "ring-1 ring-ink" : "opacity-70",
                )}
              >
                {im.url && <Image src={im.url} alt="" fill sizes="74px" className="object-cover" />}
              </button>
            ))}
          </div>
          <div
            className="relative aspect-[4/5] w-full min-w-0 flex-1 cursor-zoom-in bg-mist"
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
          {product.category && <p className="eyebrow mb-2.5 text-signal">{product.category}</p>}
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
            <p className="mt-5 border border-line bg-mist px-3 py-2 text-center text-[12px] uppercase tracking-[0.16em] text-muted">
              {t("soldOut")}
            </p>
          )}

          {/* Sizes */}
          <div className="mt-6">
            <p className="mb-2 font-button text-[11px] uppercase tracking-[0.14em]">{t("size")}</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => {
                const disabled = sizeSoldOut(s);
                return (
                  <button
                    key={s}
                    disabled={disabled}
                    onClick={() => setSize(s)}
                    className={cn(
                      "min-w-12 border px-4 py-2.5 text-xs uppercase tracking-wider transition-colors",
                      size === s ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                      disabled && "cursor-not-allowed border-line/60 text-muted line-through opacity-50",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Length — a made-to-order choice, always selectable */}
          {lengths.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 font-button text-[11px] uppercase tracking-[0.14em]">{t("length")}</p>
              <div className="flex flex-wrap gap-2">
                {lengths.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLength(l)}
                    className={cn(
                      "min-w-12 border px-3 py-2.5 text-xs tracking-wider transition-colors",
                      length === l ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tack Tack — a made-to-order choice, always selectable; sits under length */}
          <div className="mt-6">
            <p className="mb-2 font-button text-[11px] uppercase tracking-[0.14em]">{t("tackTack")}</p>
            <div className="flex flex-wrap gap-2">
              {[false, true].map((tt) => (
                <button
                  key={String(tt)}
                  onClick={() => setTackTack(tt)}
                  className={cn(
                    "border px-4 py-2.5 text-xs tracking-wider transition-colors",
                    tackTack === tt ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                  )}
                >
                  {tt ? t("tackTackYes") : t("tackTackNo")}
                </button>
              ))}
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
