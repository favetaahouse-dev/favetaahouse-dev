"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { trackMeta, newEventId } from "@/lib/meta/fbq";
import { viewContentPayload, addToCartPayload } from "@/lib/meta/events";
import { icon } from "@/lib/icon";
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

/**
 * The option chips — size, length, tack-tack. One set of classes for all three so a change
 * to the shape cannot land on some rows and miss others; they used to be three near-copies
 * that had already drifted apart on padding.
 *
 * Square, not rounded, and sentence case rather than caps: these are values (M, 56, Yes),
 * and uppercasing a value only makes it harder to read.
 */
const chip =
  "focus-ring min-w-11 border px-4 py-2.5 text-[13px] transition-colors";
const chipOn = "border-strong bg-strong text-white";
const chipOff = "border-line hover:border-strong";
const chipDead = "cursor-not-allowed border-line/60 text-muted line-through opacity-50";

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
  /** Which image the lightbox is showing — the gallery itself renders all of them. */
  const [activeImg, setActiveImg] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [adding, setAdding] = useState(false);
  /** One per gallery tile, so choosing a colour can scroll its shot into view. */
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const inColor = variants.filter((v) => v.color === color);
  const sizes = useMemo(() => sortSizes([...new Set(inColor.map((v) => v.size))]), [inColor]);

  // Stock lives on (colour, size). Tack-tack + length are always-available made-to-order choices.
  const selected = variants.find((v) => v.color === color && v.size === size);

  /**
   * Meta ViewContent — once per product, not once per variant click.
   *
   * The dependency is `product.handle`, deliberately not `selected`. A shopper trying on four
   * sizes is looking at ONE product; re-firing per selection would inflate ViewContent several
   * times over and skew every downstream ratio. The price reported is the initially-selected
   * variant's, which is also what <Price> renders on arrival.
   */
  const viewed = useRef<string | null>(null);
  useEffect(() => {
    if (viewed.current === product.handle) return;
    viewed.current = product.handle;
    const priceFils = variants.find((v) => v.color === firstColor && v.size === firstSize)?.price ?? variants[0]?.price;
    if (priceFils == null) return;
    trackMeta(
      "ViewContent",
      viewContentPayload({
        handle: product.handle,
        title: product.title,
        priceFils,
        category: product.category,
      }),
    );
    // firstColor/firstSize are derived from `variants`, which is derived from `product`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.handle]);
  const allSoldOut = variants.length > 0 && variants.every((v) => !stocked(v));
  const sizeSoldOut = (s: string) => !inColor.some((v) => v.size === s && stocked(v));

  function openLightbox(i: number) {
    setActiveImg(i);
    setLightbox(true);
  }

  /**
   * Every shot is on the page now, so picking a colour scrolls to its image rather than
   * swapping a single frame. Honours the reduced-motion setting: a smooth scroll the
   * visitor did not ask for is exactly the kind of movement that preference is about.
   */
  function jumpGallery(v?: VariantDTO) {
    if (!v?.imageUrl) return;
    const idx = product.images.findIndex((im) => im.url === v.imageUrl);
    if (idx < 0) return;
    setActiveImg(idx);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    tileRefs.current[idx]?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "center",
    });
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
    // One id shared by the browser event below and the Conversions API event that
    // addToCartAction sends, so Meta merges the pair instead of counting two add-to-carts.
    const eventId = newEventId();
    const ok = await add(selected.id, qty, length ?? undefined, tackTack, {
      eventId,
      eventSourceUrl: typeof window !== "undefined" ? window.location.href : undefined,
    });
    setAdding(false);
    if (ok) {
      // Only on success. A refused add — out of stock at the moment of the click — must not
      // report an AddToCart, or the funnel shows intent that never happened.
      trackMeta(
        "AddToCart",
        addToCartPayload({
          handle: product.handle,
          title: product.title,
          priceFils: selected.price,
          quantity: qty,
          category: product.category,
        }),
        eventId,
      );
    }
    // "Buy Now" is a compound action: it adds AND begins checkout. The InitiateCheckout is
    // fired by the checkout page itself, so both events happen with their own ids.
    if (ok && buyNow) router.push("/checkout");
    if (!ok) toast.error(t("outOfStock"));
  }

  const images = product.images.length ? product.images : [{ url: "", alt: product.title }];

  return (
    <div className="px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1200px]">
        {/* Gallery — the whole set, stacked down the page.
            The thumbnail rail this replaces made every shot compete for one 45%-wide frame
            beside the buying controls. A garment shot full-length deserves the container's
            full width, and a shopper who wants the third angle should be able to scroll to
            it rather than hunt for a 74px chip. The first image leads at full width; the
            rest follow in a grid, and any of them opens the lightbox. */}
        <div className="flex flex-col gap-3">
          {images[0]?.url && (
            <button
              type="button"
              ref={(el) => { tileRefs.current[0] = el; }}
              onClick={() => openLightbox(0)}
              aria-label={t("viewProduct")}
              // 4:5 on desktop, not a landscape band: the photography is 2:3, so a 16:10
              // lead cropped nearly 60% of the frame's height and cut the model off at the
              // knees. 4:5 trims ~17% and keeps the garment whole, which is the entire job
              // of the opening shot.
              className="relative aspect-[3/4] w-full cursor-zoom-in bg-mist md:aspect-[4/5]"
            >
              <Image
                src={images[0].url}
                alt={product.title}
                fill
                priority
                sizes="(max-width:1200px) 100vw, 1200px"
                className="object-cover"
              />
            </button>
          )}

          {images.length > 1 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {images.slice(1).map((im, i) => (
                <button
                  key={i + 1}
                  type="button"
                  ref={(el) => { tileRefs.current[i + 1] = el; }}
                  onClick={() => openLightbox(i + 1)}
                  aria-label={t("viewProduct")}
                  className="relative aspect-[2/3] w-full cursor-zoom-in bg-mist"
                >
                  {im.url && (
                    <Image
                      src={im.url}
                      alt=""
                      fill
                      sizes="(max-width:768px) 50vw, 33vw"
                      className="object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info — below the gallery now, and held to a readable measure rather than
            stretched across the full 1200px. */}
        <div className="mt-12 max-w-[560px]">
          <h1 className="display text-[28px] md:text-[33px]">{product.title}</h1>
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
              <p className="mb-2.5 font-button text-[13px] font-medium text-strong">
                {t("color")}: <span className="font-normal text-muted">{color}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c.color}
                    onClick={() => selectColor(c.color)}
                    title={c.color}
                    aria-label={c.color}
                    aria-pressed={color === c.color}
                    className={cn(
                      "h-8 w-8 border transition-all",
                      color === c.color ? "ring-1 ring-strong ring-offset-2" : "border-line",
                    )}
                    style={{ backgroundColor: c.hex ?? "var(--color-mist)" }}
                  />
                ))}
              </div>
            </div>
          )}

          {allSoldOut && (
            <p className="mt-5 border border-line bg-mist px-3 py-2 text-center text-[12px] tracking-[0.16em] text-muted uppercase">
              {t("soldOut")}
            </p>
          )}

          {/* Sizes */}
          <div className="mt-6">
            <p className="mb-2.5 font-button text-[13px] font-medium text-strong">{t("size")}</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => {
                const disabled = sizeSoldOut(s);
                return (
                  <button
                    key={s}
                    disabled={disabled}
                    onClick={() => setSize(s)}
                    aria-pressed={size === s}
                    className={cn(chip, size === s ? chipOn : chipOff, disabled && chipDead)}
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
              <p className="mb-2.5 font-button text-[13px] font-medium text-strong">{t("length")}</p>
              <div className="flex flex-wrap gap-2">
                {lengths.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLength(l)}
                    aria-pressed={length === l}
                    className={cn(chip, length === l ? chipOn : chipOff)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tack Tack — a made-to-order choice, always selectable; sits under length */}
          <div className="mt-6">
            <p className="mb-2.5 font-button text-[13px] font-medium text-strong">{t("tackTack")}</p>
            <div className="flex flex-wrap gap-2">
              {[false, true].map((tt) => (
                <button
                  key={String(tt)}
                  onClick={() => setTackTack(tt)}
                  aria-pressed={tackTack === tt}
                  className={cn(chip, "px-5", tackTack === tt ? chipOn : chipOff)}
                >
                  {tt ? t("tackTackYes") : t("tackTackNo")}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity + actions */}
          <div className="mt-8 flex items-center gap-3">
            <div className="flex items-center border border-strong">
              <button
                className="focus-ring px-3 py-3 transition-opacity hover:opacity-60"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="decrease"
              >
                <Minus {...icon.inline} />
              </button>
              <span className="min-w-8 text-center text-sm">{qty}</span>
              <button
                className="focus-ring px-3 py-3 transition-opacity hover:opacity-60"
                onClick={() => setQty((q) => Math.min(selected?.stock ?? 1, q + 1))}
                aria-label="increase"
              >
                <Plus {...icon.inline} />
              </button>
            </div>
            <WishlistButton handle={product.handle} className="h-12 w-12 border border-strong" />
          </div>

          {/* Add to cart leads — it is the action most shoppers want, and Buy now is the
              shortcut for the ones who have already decided. Side by side once there is
              room for both to stay legible. */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => handleAdd(false)} disabled={adding} className="btn-brand flex-1 py-4">
              {t("addToCart")}
            </button>
            <button onClick={() => handleAdd(true)} disabled={adding} className="btn-outline flex-1 py-4">
              {t("buyNow")}
            </button>
          </div>

          {/* These two lines are a reassurance, and a 15px hairline glyph beside 12px grey type
              was too quiet to do that job. 18px marks against 13px ink read at a glance without
              turning the block into a feature. */}
          <div className="mt-6 space-y-2.5 border-y border-line py-4 text-[13px] text-ink">
            <p className="flex items-center gap-2.5">
              <PackageCheck {...icon.inline} /> {t("freeShipping")}
            </p>
            <p className="flex items-center gap-2.5">
              <Truck {...icon.inline} /> {t("delivery")}
            </p>
          </div>

          <ProductAccordion product={product} />

          {/* The category, demoted from a kicker above the title to a footnote below the
              details. It is a navigation aid, not part of the product's identity, and at
              the top it was the first thing read on the page. */}
          {product.category && (
            <p className="mt-6 border-t border-line pt-5 text-[12px] text-muted">
              {product.category}
            </p>
          )}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(false)}
        >
          <button className="focus-ring absolute end-6 top-6 -m-2 p-2 text-white" aria-label="Close">
            <X {...icon.overlay} />
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
