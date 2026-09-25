"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, Truck, PackageCheck, Scissors } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/lib/i18n-navigation";
import { Price } from "@/components/Price";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { ProductAccordion } from "@/components/product/ProductAccordion";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductLightbox } from "@/components/product/ProductLightbox";
import { StickyBuyBar } from "@/components/product/StickyBuyBar";
import { useCart } from "@/components/providers/cart-context";
import { sortSizes, variantLabel } from "@/lib/variant-options";
import { MAX_MTO_QTY } from "@/lib/measurements";
import { trackMeta, newEventId } from "@/lib/meta/fbq";
import { viewContentPayload, addToCartPayload } from "@/lib/meta/events";
import { icon } from "@/lib/icon";
import { cn } from "@/lib/utils";

// A variant is one colour+size, holding stock — the ready-to-wear half of the catalogue.
// Made-to-order has no variant at all: it is a colour, a size and a length, cut after the sale.
export type VariantDTO = {
  id: string;
  /** The colour ROW's id. colors[].name is localised; variants.color is not — so ids match. */
  colorId: string;
  size: string;
  sku: string | null;
  price: number;
  compareAt: number | null;
  stock: number;
  available: boolean;
  imageUrl: string | null;
};

export type ProductColorDTO = {
  id: string;
  name: string;
  hex: string | null;
  imageUrl: string | null;
};

/** Everything the made-to-order panel needs, already merged with the house defaults, so the
 *  client resolves nothing. Null when the product doesn't offer it. */
export type MtoDTO = {
  price: number;
  compareAt: number | null;
  leadMin: number;
  leadMax: number;
  /** Always selectable — a made-to-order piece is cut after the sale and never sells out. */
  sizes: string[];
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
  colors: ProductColorDTO[];
  variants: VariantDTO[];
  lengths: number[]; // offered lengths in inches (from the CMS list), in both modes
  offersMto: boolean;
  offersRtw: boolean;
  mto: MtoDTO | null;
};

type Mode = "MTO" | "RTW";

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
const chipOn = "border-strong bg-strong text-paper";
const chipOff = "border-line hover:border-strong";
const chipDead = "cursor-not-allowed border-line/60 text-muted line-through opacity-50";

export function ProductDetail({ product }: { product: ProductDetailDTO }) {
  const t = useTranslations("product");
  const router = useRouter();
  const { add, addMto } = useCart();
  const { variants, colors, mto, offersMto, offersRtw } = product;

  const firstColorId = colors[0]?.id ?? "";
  const firstSize = firstStocked(variants.filter((v) => v.colorId === firstColorId))?.size ?? "";
  const lengths = product.lengths;

  /**
   * Made-to-order leads when the product offers it. That is the business, not a UI preference:
   * ready-to-wear is now the secondary line, so it must not be what a shopper lands on.
   */
  const initialMode: Mode = offersMto ? "MTO" : "RTW";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [colorId, setColorId] = useState(firstColorId);
  const [size, setSize] = useState(initialMode === "MTO" ? (mto?.sizes[0] ?? "") : firstSize);
  const [tackTack, setTackTack] = useState(false); // "No" by default
  const [length, setLength] = useState<number | null>(lengths[0] ?? null);
  const [qty, setQty] = useState(1);
  /** One index for the gallery, the lightbox and the colour jump, so closing the zoomed
   *  view on the third shot leaves the gallery on the third shot. */
  const [imageIndex, setImageIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [adding, setAdding] = useState(false);
  /** The two sentinels that bound the mobile buy bar — see StickyBuyBar. */
  const ctaRef = useRef<HTMLDivElement>(null);
  const detailsEndRef = useRef<HTMLDivElement>(null);

  const color = colors.find((c) => c.id === colorId);
  const inColor = variants.filter((v) => v.colorId === colorId);
  const stockedSizes = useMemo(() => sortSizes([...new Set(inColor.map((v) => v.size))]), [inColor]);

  // Stock lives on (colour, size). Length and tack-tack are choices on the line, not stock axes.
  const selected = variants.find((v) => v.colorId === colorId && v.size === size);
  const isMto = mode === "MTO";
  // One row of size chips for both modes. Ready-to-wear offers what this colour has on the rail;
  // made-to-order offers every size it is cut in, none of which can sell out.
  const sizes = isMto ? (mto?.sizes ?? []) : stockedSizes;
  const price = isMto ? (mto?.price ?? 0) : (selected?.price ?? 0);
  const compareAt = isMto ? (mto?.compareAt ?? null) : (selected?.compareAt ?? null);
  const maxQty = isMto ? MAX_MTO_QTY : (selected?.stock ?? 1);

  /**
   * Meta ViewContent — once per product, not once per variant click.
   *
   * The dependency is `product.handle`, deliberately not `selected` and deliberately not `mode`.
   * A shopper trying on four sizes, or toggling between made-to-order and ready-to-wear, is
   * looking at ONE product; re-firing per selection would inflate ViewContent several times over
   * and skew every downstream ratio. The price reported is the one the page opens on, which is
   * also what <Price> renders on arrival.
   */
  const viewed = useRef<string | null>(null);
  useEffect(() => {
    if (viewed.current === product.handle) return;
    viewed.current = product.handle;
    const priceFils = offersMto
      ? mto?.price
      : (variants.find((v) => v.colorId === firstColorId && v.size === firstSize)?.price ?? variants[0]?.price);
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
    // firstColorId/firstSize are derived from `variants`, which is derived from `product`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.handle]);

  // Only meaningful for ready-to-wear: made-to-order is cut after the sale and never sells out.
  const allSoldOut = offersRtw && variants.length > 0 && variants.every((v) => !stocked(v));
  const sizeSoldOut = (s: string) => !inColor.some((v) => v.size === s && stocked(v));

  function openLightbox(i: number) {
    setImageIndex(i);
    setLightbox(true);
  }

  /**
   * Colour → image. A colour can now carry its own photograph (product_colors.image_url), so
   * this reads the colour row rather than hunting a variant for one. Still a no-op for any
   * colour with no image attached, which is most of them — attach one and picking that colour
   * moves the gallery to it, with no code change here.
   */
  function jumpGallery(c?: ProductColorDTO) {
    if (!c?.imageUrl) return;
    const i = product.images.findIndex((im) => im.url === c.imageUrl);
    if (i >= 0) setImageIndex(i);
  }

  function selectColor(id: string) {
    const inC = variants.filter((v) => v.colorId === id);
    setColorId(id);
    // Only ready-to-wear sizes depend on the colour — what is on the rail in it. A made-to-order
    // size is cut in any colour, so the shopper's choice stands.
    if (!isMto) setSize(firstStocked(inC)?.size ?? inC[0]?.size ?? "");
    jumpGallery(colors.find((c) => c.id === id));
  }

  function switchMode(next: Mode) {
    setMode(next);
    // Keep the chosen size across the switch when the other mode can honour it; otherwise land
    // on its first — for ready-to-wear, the first one actually in stock in this colour.
    if (next === "MTO") {
      const offered = mto?.sizes ?? [];
      if (!offered.includes(size)) setSize(offered[0] ?? "");
    } else {
      const same = inColor.find((v) => v.size === size);
      if (!same || !stocked(same)) setSize(firstStocked(inColor)?.size ?? "");
    }
    // Quantity is capped by different things in the two modes; carrying 8 across from a
    // made-to-order line into a size with 2 in stock would silently over-order.
    setQty(1);
  }

  async function handleAdd(buyNow = false) {
    if (!color) {
      toast.error(t("selectColor"));
      return;
    }
    const eventId = newEventId();
    const meta = {
      eventId,
      eventSourceUrl: typeof window !== "undefined" ? window.location.href : undefined,
    };

    if (lengths.length > 0 && length == null) {
      toast.error(t("selectLength"));
      return;
    }

    if (isMto) {
      if (!mto) return;
      if (!size) {
        toast.error(t("selectSize"));
        return;
      }
      setAdding(true);
      const err = await addMto(
        {
          handle: product.handle,
          colorId: color.id,
          quantity: qty,
          size,
          length: length ?? undefined,
          tackTack,
        },
        meta,
      );
      setAdding(false);
      if (err) {
        toast.error(err === "unavailable" ? t("outOfStock") : t("unavailableCombination"));
        return;
      }
      trackMeta(
        "AddToCart",
        addToCartPayload({
          handle: product.handle,
          title: product.title,
          priceFils: mto.price,
          quantity: qty,
          category: product.category,
        }),
        eventId,
      );
      if (buyNow) router.push("/checkout");
      return;
    }

    if (!selected) {
      toast.error(t("selectSize"));
      return;
    }
    if (!stocked(selected)) {
      toast.error(t("outOfStock"));
      return;
    }
    setAdding(true);
    // One id shared by the browser event below and the Conversions API event that
    // addToCartAction sends, so Meta merges the pair instead of counting two add-to-carts.
    const ok = await add(selected.id, qty, length ?? undefined, tackTack, meta);
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

  const leadLine = mto ? t("mtoLead", { min: mto.leadMin, max: mto.leadMax }) : "";

  return (
    <div className="px-4 py-8 md:px-8 xl:px-10">
      <div className="mx-auto max-w-[1440px]">
        {/* One band: photography beside the buying controls, rather than the full-width
            stack that pushed the price four screens down the page and stranded ~640px of
            empty cream beside the panel underneath it. Single column until xl, because
            below that the two halves would each be too narrow to be worth having. */}
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_clamp(340px,30%,420px)] xl:gap-12">
          <ProductGallery
            images={product.images}
            title={product.title}
            index={imageIndex}
            onIndexChange={setImageIndex}
            onZoom={openLightbox}
          />

          <div className="max-w-[560px] xl:max-w-none">
            <h1 className="display text-[28px] md:text-[33px]">{product.title}</h1>
            <div className="mt-3 text-lg">
              {price > 0 && <Price cents={price} compareAt={compareAt} />}
            </div>
            {!isMto && selected?.sku && (
              <p className="mt-1 text-xs text-muted">
                {t("sku")}: {selected.sku}
              </p>
            )}

            {/* How it's made. Rendered only when there is a genuine choice — a product that
                offers one way of buying should not be asked a question with one answer. */}
            {offersMto && offersRtw && mto && (
              <div className="mt-7">
                <p className="mb-2.5 font-button text-[13px] font-medium text-strong">{t("chooseHow")}</p>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("chooseHow")}>
                  {([
                    { key: "MTO" as const, label: t("madeToOrder"), sub: leadLine, cents: mto.price },
                    { key: "RTW" as const, label: t("readyToWear"), sub: t("rtwBlurb"), cents: selected?.price ?? 0 },
                  ]).map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      role="radio"
                      aria-checked={mode === o.key}
                      onClick={() => switchMode(o.key)}
                      className={cn(
                        "focus-ring border px-3.5 py-3 text-start transition-colors",
                        mode === o.key ? "border-strong bg-mist" : "border-line hover:border-strong",
                      )}
                    >
                      <span className="block font-button text-[13px] font-medium text-strong">{o.label}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{o.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Colours — the one axis both modes share, and the reason they live in their own
                table rather than being repeated across the size grid. */}
            {colors.length > 0 && (
              <div className="mt-7">
                <p className="mb-2.5 font-button text-[13px] font-medium text-strong">
                  {t("color")}: <span className="font-normal text-muted">{color?.name}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectColor(c.id)}
                      title={c.name}
                      aria-label={c.name}
                      aria-pressed={colorId === c.id}
                      className={cn(
                        "h-8 w-8 border transition-all",
                        colorId === c.id
                          ? "ring-1 ring-strong ring-offset-2 ring-offset-paper"
                          : "border-line-strong",
                      )}
                      style={{ backgroundColor: c.hex ?? "var(--color-mist)" }}
                    />
                  ))}
                </div>
              </div>
            )}

            {allSoldOut && !offersMto && (
              <p className="mt-5 border border-line bg-mist px-3 py-2 text-center text-[12px] tracking-[0.16em] text-muted uppercase">
                {t("soldOut")}
              </p>
            )}

            {/* Sizes — one row for both modes, as on Alessia. Only a ready-to-wear size can sell
                out; a made-to-order one is cut after the sale. */}
            {sizes.length > 0 && (
              <div className="mt-6">
                <p className="mb-2.5 font-button text-[13px] font-medium text-strong">{t("size")}</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => {
                    const disabled = !isMto && sizeSoldOut(s);
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
            )}

            {/* Length — the hem, picked by number in inches, in both modes. Always selectable:
                it is a cutting instruction, not a stock axis. */}
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

            {/* Tack Tack — offered in BOTH modes. It is a finishing choice, not a fit
                dimension, and the tailor needs it either way. */}
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
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  aria-label="increase"
                >
                  <Plus {...icon.inline} />
                </button>
              </div>
              <WishlistButton handle={product.handle} className="h-12 w-12 border border-strong" />
            </div>

            {/* Add to cart leads — it is the action most shoppers want, and Buy now is the
                shortcut for the ones who have already decided. Side by side once there is
                room for both to stay legible; px-5 because the panel is now a 340-420px
                column rather than the 560px measure these were tuned against. */}
            <div ref={ctaRef} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => handleAdd(false)} disabled={adding} className="btn-brand flex-1 px-5 py-4">
                {t("addToCart")}
              </button>
              <button onClick={() => handleAdd(true)} disabled={adding} className="btn-outline flex-1 px-5 py-4">
                {t("buyNow")}
              </button>
            </div>

            {/* These two lines are a reassurance, and a 15px hairline glyph beside 12px grey type
                was too quiet to do that job. 18px marks against 13px ink read at a glance without
                turning the block into a feature. */}
            <div className="mt-6 space-y-2.5 border-y border-line py-4 text-[13px] text-ink">
              {isMto && mto && (
                <>
                  <p className="flex items-center gap-2.5">
                    <Scissors {...icon.inline} /> {leadLine}
                  </p>
                  <p className="text-[12px] text-muted">{t("mtoNoReturn")}</p>
                </>
              )}
              <p className="flex items-center gap-2.5">
                <PackageCheck {...icon.inline} /> {t("freeShipping")}
              </p>
              <p className="flex items-center gap-2.5">
                <Truck {...icon.inline} /> {t("delivery")}
              </p>
            </div>
          </div>
        </div>

        {/* The written detail, lifted out of the buying column. Prose wants a measure it
            can be read at, not whatever is left over beside a photograph — and taking
            ~450px off the panel is also what lets the panel and the gallery finish at
            roughly the same place. */}
        <div className="mt-14 max-w-[720px] xl:mt-20">
          <ProductAccordion product={product} />

          {/* The category, demoted from a kicker above the title to a footnote below the
              details. It is a navigation aid, not part of the product's identity, and at
              the top it was the first thing read on the page. */}
          {product.category && (
            <p className="mt-6 border-t border-line pt-5 text-[12px] text-muted">
              {product.category}
            </p>
          )}
          {/* Marks where the product's own copy ends, for the mobile buy bar. h-px, not
              zero-height: a degenerate rect is not something every engine agrees to
              intersect. */}
          <div ref={detailsEndRef} aria-hidden className="h-px" />
        </div>
      </div>

      {/* The gate is `isMto || selected`, not `selected` alone: a made-to-order-only product
          has no variant to select, and would otherwise lose its mobile buy bar entirely. */}
      {(isMto ? !!mto : !!selected) && (
        <StickyBuyBar
          price={price}
          compareAt={compareAt}
          label={variantLabel({
            color: color?.name ?? "",
            size,
            length,
            tackTack,
            madeToOrder: isMto,
            madeToOrderLabel: t("madeToOrder"),
          })}
          disabled={adding}
          onAdd={() => handleAdd(false)}
          ctaRef={ctaRef}
          endRef={detailsEndRef}
        />
      )}

      {lightbox && (
        <ProductLightbox
          images={product.images}
          title={product.title}
          index={imageIndex}
          onIndexChange={setImageIndex}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}
