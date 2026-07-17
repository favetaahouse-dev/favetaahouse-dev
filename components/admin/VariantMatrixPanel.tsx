"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";
import { Button, Panel, SectionLabel } from "./ui";
import { generateVariants } from "@/lib/actions/products";
import { cellKey, sortSizes } from "@/lib/variant-options";
import { cn } from "@/lib/utils";

const input =
  "w-full border border-edge bg-canvas px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-faint focus:border-accent/60";

export type MatrixSpec = {
  colors: { name: string; hex: string }[];
  sizes: string[];
  lengths: number[];
  tackTacks: boolean[];
  price: number;
  stock: number;
};

/**
 * The colour × size × length × tack-tack generator. Rendered on both New and Edit.
 * - create: reports its spec upward so the parent submits it with the product.
 * - edit: has its own "Generate variants" button (never wired into "Save changes"), and
 *   previews new-vs-existing so nobody creates hundreds of rows by accident.
 */
export function VariantMatrixPanel({
  options,
  mode,
  productId,
  existingKeys,
  onSpecChange,
}: {
  options: { sizes: string[]; lengths: number[] };
  mode: "create" | "edit";
  productId?: string;
  existingKeys?: Set<string>;
  onSpecChange?: (spec: MatrixSpec) => void;
}) {
  const router = useRouter();
  const [colors, setColors] = useState<{ name: string; hex: string }[]>([{ name: "Black", hex: "#111111" }]);
  const [sizes, setSizes] = useState<string[]>(mode === "create" ? [] : []);
  const [lengths, setLengths] = useState<number[]>(options.lengths);
  const [offerTack, setOfferTack] = useState(true);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [busy, setBusy] = useState(false);

  const tackTacks = offerTack ? [false, true] : [false];
  const cleanColors = colors.filter((c) => c.name.trim());

  const spec: MatrixSpec = useMemo(
    () => ({
      colors: cleanColors.length ? cleanColors : [{ name: "Default", hex: "#111111" }],
      sizes,
      lengths: lengths.length ? lengths : [50],
      tackTacks,
      price: Math.round(Number(price) || 0),
      stock: Math.round(Number(stock) || 0),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors, sizes, lengths, offerTack, price, stock],
  );

  useEffect(() => onSpecChange?.(spec), [spec, onSpecChange]);

  const requested = spec.colors.length * spec.sizes.length * spec.lengths.length * spec.tackTacks.length;
  const willCreate = useMemo(() => {
    if (!existingKeys) return requested;
    let n = 0;
    for (const c of spec.colors)
      for (const s of spec.sizes)
        for (const l of spec.lengths)
          for (const t of spec.tackTacks) if (!existingKeys.has(cellKey(c.name.trim(), s, l, t))) n++;
    return n;
  }, [spec, existingKeys, requested]);

  const toggle = <T,>(arr: T[], v: T, set: (x: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const generate = async () => {
    if (!productId) return;
    if (!spec.sizes.length) return toast.error("Pick at least one size");
    if (willCreate > 200 && !confirm(`This will create ${willCreate} new variants. Continue?`)) return;
    setBusy(true);
    try {
      const res = await generateVariants(productId, spec);
      toast.success(res.created ? `Created ${res.created} variants` : "No new combinations — all already exist");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="space-y-6 p-5">
      <div>
        <SectionLabel className="mb-1">Variants</SectionLabel>
        <p className="text-[11px] text-faint">
          {mode === "create"
            ? "Every colour × size × length × tack-tack combination becomes a stockable variant. Set stock per combination after creating."
            : "Add missing combinations. Existing variants keep their stock and price untouched."}
        </p>
      </div>

      {/* colours */}
      <div>
        <SectionLabel className="mb-2">Colours</SectionLabel>
        <div className="space-y-2">
          {colors.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="color" value={c.hex} onChange={(e) => setColors((cs) => cs.map((x, idx) => (idx === i ? { ...x, hex: e.target.value } : x)))} className="h-8 w-11 cursor-pointer border border-edge bg-canvas p-0.5" aria-label="Pick colour" />
              <input value={c.name} onChange={(e) => setColors((cs) => cs.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))} placeholder="Colour name (e.g. Black, Olive)" className={cn(input, "flex-1")} />
              <button type="button" onClick={() => setColors((cs) => cs.filter((_, idx) => idx !== i))} className="text-faint hover:text-danger" aria-label="Remove colour"><X size={15} /></button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => setColors((cs) => [...cs, { name: "", hex: "#c69229" }])}><Plus size={13} /> Add colour</Button>
      </div>

      {/* sizes */}
      <div>
        <SectionLabel className="mb-2">Sizes</SectionLabel>
        {options.sizes.length === 0 ? (
          <p className="text-[11px] text-danger">No sizes defined. Add them under Content → Sizes &amp; Lengths.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {sortSizes(options.sizes).map((s) => (
              <button key={s} type="button" onClick={() => toggle(sizes, s, setSizes)}
                className={cn("border px-3 py-1.5 text-[13px]", sizes.includes(s) ? "border-accent bg-accent/15 text-foreground" : "border-edge text-secondary hover:border-accent/50")}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* lengths */}
      <div>
        <SectionLabel className="mb-2">Lengths</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {options.lengths.map((l) => (
            <button key={l} type="button" onClick={() => toggle(lengths, l, setLengths)}
              className={cn("border px-3 py-1.5 text-[13px]", lengths.includes(l) ? "border-accent bg-accent/15 text-foreground" : "border-edge text-secondary hover:border-accent/50")}>
              {l}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-3 text-[11px] text-faint">
          <button type="button" className="hover:text-foreground" onClick={() => setLengths(options.lengths)}>Select all</button>
          <button type="button" className="hover:text-foreground" onClick={() => setLengths([])}>Clear</button>
        </div>
      </div>

      {/* tack tack */}
      <label className="flex items-center gap-2 text-[13px] text-foreground">
        <input type="checkbox" checked={offerTack} onChange={(e) => setOfferTack(e.target.checked)} />
        Offer Tack Tack (a Yes / No choice)
      </label>

      {/* price + stock */}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block"><SectionLabel>Price (fils)</SectionLabel><input type="number" min={0} className={input} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 45000" /></label>
        <label className="block"><SectionLabel>Starting stock per combination</SectionLabel><input type="number" min={0} className={input} value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" /></label>
      </div>

      <p className="text-[11px] text-faint">
        {mode === "edit" && existingKeys
          ? <>Requested <b className="text-secondary">{requested}</b> · already exist <b className="text-secondary">{requested - willCreate}</b> · will create <b className="text-secondary">{willCreate}</b>.</>
          : <><b className="text-secondary">{requested}</b> variant(s) will be created. Prices are in fils (45000 = QAR 450).</>}
      </p>

      {mode === "edit" && (
        <div className="flex justify-end">
          <Button variant="primary" disabled={busy || willCreate === 0} onClick={generate}>
            {busy ? "Generating…" : `Generate ${willCreate} variant${willCreate === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}
    </Panel>
  );
}
