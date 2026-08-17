"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Plus, Check } from "lucide-react";
import { Button, IconButton, Panel, PanelHeader, SubsectionHeader, FieldLabel, fieldInput } from "./ui";
import { generateVariants } from "@/lib/actions/products";
import { sortSizes } from "@/lib/variant-options";
import { parsePriceStrict, PRICE_INPUT_HINT } from "@/lib/money";
import { cn } from "@/lib/utils";

const input = fieldInput;

export type MatrixSpec = {
  colors: { name: string; hex: string }[];
  sizes: string[];
  /** null when the price box is empty or unreadable — NOT 0. Generating at a silent zero is how
   *  products ended up free: the old parser answered 0 to an empty box and the server accepted it. */
  price: number | null;
  stock: number;
};

/**
 * The colour × size variant generator. Each colour+size holds stock; length and tack-tack are
 * made-to-order choices on the storefront, not part of a variant.
 * - create: reports its spec upward so the parent submits it with the product.
 * - edit: has its own "Generate variants" button (never wired into "Save changes"), previewing
 *   new-vs-existing so nobody creates rows by accident.
 */
export function VariantMatrixPanel({
  options,
  mode,
  productId,
  existingKeys,
  onSpecChange,
  sizesDisabled = false,
}: {
  options: { sizes: string[]; lengths: number[] };
  mode: "create" | "edit";
  productId?: string;
  existingKeys?: Set<string>; // "color|size" keys already in the product
  onSpecChange?: (spec: MatrixSpec) => void;
  /** Made-to-order only: there is no size axis, so the size and stock steps are hidden. */
  sizesDisabled?: boolean;
}) {
  const router = useRouter();
  const [colors, setColors] = useState<{ name: string; hex: string }[]>([{ name: "Black", hex: "#111111" }]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [busy, setBusy] = useState(false);

  const cleanColors = colors.filter((c) => c.name.trim());

  const spec: MatrixSpec = useMemo(
    () => ({
      colors: cleanColors.length ? cleanColors : [{ name: "Default", hex: "#111111" }],
      sizes,
      price: parsePriceStrict(price),
      stock: Math.round(Number(stock) || 0),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors, sizes, price, stock],
  );

  useEffect(() => onSpecChange?.(spec), [spec, onSpecChange]);

  const requested = spec.colors.length * spec.sizes.length;
  const willCreate = useMemo(() => {
    if (!existingKeys) return requested;
    let n = 0;
    for (const c of spec.colors) for (const s of spec.sizes) if (!existingKeys.has(`${c.name.trim()}|${s}`)) n++;
    return n;
  }, [spec, existingKeys, requested]);

  const toggle = (v: string) => setSizes((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));

  const generate = async () => {
    if (!productId) return;
    if (!spec.sizes.length) return toast.error("Pick at least one size");
    // Without this a blank price box created every variant at QAR 0.00 — the server's schema
    // legitimately accepts 0, so refusing the ACCIDENTAL zero has to happen here, where an empty
    // box and a typed "0" are still distinguishable.
    if (spec.price === null) return toast.error(`Enter a price before generating — ${PRICE_INPUT_HINT}`);
    setBusy(true);
    try {
      const res = await generateVariants(productId, { ...spec, price: spec.price });
      toast.success(res.created ? `Created ${res.created} variants` : "No new combinations — all already exist");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  // Read-only. Derived from the SAME three conditions as the button's `disabled` below, so the
  // two can't drift — but the disabled expression itself is untouched. A `title` would not do:
  // most browsers fire no events at all on a disabled button, so the tooltip never appears, and
  // it never appears on touch either. This is the one thing that made the panel feel broken:
  // the button greys out and nothing anywhere says why.
  const disabledReason =
    busy ? null
      : spec.price === null ? "Enter a price to enable this."
      : willCreate === 0
        ? sizes.length === 0 ? "Pick at least one size to enable this."
          : "Every one of these combinations already exists."
        : null;

  return (
    <Panel>
      <PanelHeader
        title={mode === "create" ? "Colours & sizes" : "Add colours & sizes"}
        description={
          <>
            A variant is one colour + size, with its own quantity. Length and Tack Tack are choices the
            customer picks on the product page — they aren&apos;t stocked separately.
            {mode === "edit" && " New combinations appear in Prices & quantities below."}
          </>
        }
      />
      <div className="space-y-6 p-5">
        {/* colours */}
        <div>
          <SubsectionHeader step={1} title="Colours" />
          <div className="space-y-2">
            {colors.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                {/* Each control names the row it belongs to. They all used to read "Pick colour" /
                    "Remove colour", so a screen-reader element list was N identical entries. */}
                <input type="color" value={c.hex} onChange={(e) => setColors((cs) => cs.map((x, idx) => (idx === i ? { ...x, hex: e.target.value } : x)))} className="h-9 w-11 shrink-0 cursor-pointer border border-field bg-canvas p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Swatch for ${c.name.trim() || `colour ${i + 1}`}`} />
                <input value={c.name} onChange={(e) => setColors((cs) => cs.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))} placeholder="Colour name (e.g. Black, Olive)" aria-label={`Name of colour ${i + 1}`} className={cn(input, "flex-1")} />
                <IconButton type="button" onClick={() => setColors((cs) => cs.filter((_, idx) => idx !== i))} className="shrink-0 hover:text-danger" aria-label={`Remove ${c.name.trim() || `colour ${i + 1}`}`}><X size={16} /></IconButton>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" className="mt-2.5" onClick={() => setColors((cs) => [...cs, { name: "", hex: "#111111" }])}><Plus size={14} /> Add colour</Button>
        </div>

        {/* sizes — absent entirely for made-to-order, which has no size axis to cross the
            colours with. Hidden rather than disabled: a greyed-out step still reads as
            something the owner forgot to fill in. */}
        {sizesDisabled ? (
          <p className="border border-field px-3.5 py-3 text-[12px] text-secondary">
            Made-to-order pieces are cut to the customer’s measurements, so they have no sizes and
            no stock. The price is set under “How it’s made” above.
          </p>
        ) : (
        <div>
          <SubsectionHeader step={2} title="Sizes" description="Every size you pick is created for every colour above." />
          {options.sizes.length === 0 ? (
            <p className="text-[12px] text-secondary">
              No sizes defined yet.{" "}
              <Link href="/admin/content/variant-options" className="text-accent underline underline-offset-2">
                Add them under Content → Sizes &amp; Lengths
              </Link>
              , then come back here.
            </p>
          ) : (
            // A pressed chip used to differ from an unpressed one by a 15%-alpha tint and nothing
            // else — and carried no state at all for a screen reader. Now: a check glyph, a solid
            // fill, and aria-pressed. `toggle` is untouched.
            <div role="group" aria-label="Sizes to create" className="flex flex-wrap gap-1.5">
              {sortSizes(options.sizes).map((s) => {
                const on = sizes.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggle(s)} aria-pressed={on}
                    className={cn(
                      "inline-flex items-center gap-1.5 border px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      on ? "border-accent bg-accent font-medium text-accent-fg" : "border-field text-secondary hover:border-accent hover:text-foreground",
                    )}>
                    {on && <Check size={13} aria-hidden="true" />}
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* price + stock — the ready-to-wear price. Made-to-order carries its own, set once on
            the product form rather than per size. */}
        {!sizesDisabled && (
        <div>
          <SubsectionHeader step={3} title="Price & starting quantity" description="Applied to every variant created. Both can be edited per size afterwards." />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <FieldLabel required hint="450 for QAR 450.00, or 450.50 to include fils.">Price (QAR)</FieldLabel>
              {/* text, not number: a number input hands back "" for anything the browser dislikes, which
                  is indistinguishable from an empty box — and both used to generate variants at QAR 0. */}
              <input type="text" inputMode="decimal"
                className={cn(input, price.trim() && spec.price === null && "border-danger")}
                aria-invalid={price.trim() && spec.price === null ? true : undefined}
                value={price} onChange={(e) => setPrice(e.target.value)} placeholder="450" />
              {price.trim() && spec.price === null && (
                <span role="alert" className="mt-1 block text-[11px] text-danger">{PRICE_INPUT_HINT}</span>
              )}
            </label>
            <label className="block">
              <FieldLabel hint="Leave at 0 and add stock later.">Starting quantity per size</FieldLabel>
              <input type="number" min={0} className={input} value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
            </label>
          </div>
        </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge px-5 py-3">
        <p className="text-[12px] text-secondary">
          {sizesDisabled
            ? "Colours only — made-to-order pieces have no size rows."
            : mode === "edit" && existingKeys
            ? <>Requested <b className="font-medium text-foreground">{requested}</b> · already exist <b className="font-medium text-foreground">{requested - willCreate}</b> · will create <b className="font-medium text-foreground">{willCreate}</b>.</>
            : <><b className="font-medium text-foreground">{requested}</b> variant(s) will be created when you save.</>}
        </p>
        {mode === "edit" && !sizesDisabled && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {disabledReason && <span id="generate-reason" className="text-[12px] text-secondary">{disabledReason}</span>}
            <Button
              variant="primary"
              aria-describedby={disabledReason ? "generate-reason" : undefined}
              disabled={busy || willCreate === 0 || spec.price === null}
              onClick={generate}
            >
              {busy ? "Generating…" : `Generate ${willCreate} variant${willCreate === 1 ? "" : "s"}`}
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}
