"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button, Panel, SectionLabel } from "./ui";
import { setVariantStock, setVariantPrices, setProductTotal, deleteVariants } from "@/lib/actions/products";
import { sortSizes } from "@/lib/variant-options";
import { usePermissions } from "@/lib/rbac/use-permissions";
import { parsePriceStrict, filsToPriceInput, formatMoney, PRICE_INPUT_HINT } from "@/lib/money";
import type { AdminVariant } from "@/lib/data/admin-catalog";
import { cn } from "@/lib/utils";

const input = "w-24 border border-edge bg-canvas px-2 py-1 text-[13px] text-foreground outline-none focus:border-accent/60";

/**
 * Quantity and price per colour + size, with an advisory product total.
 *
 * ONE button saves everything. It used to be two — a primary "Save quantities" that compared only
 * stock (so a price-only edit left it greyed out) and sent only stock (so a price edited alongside
 * a quantity was silently dropped), plus a per-row "Price" button that spent most of its life
 * disabled and therefore read as a column label. Between them, "edit the price and save" was a
 * thing the panel could not actually do.
 *
 * Prices are typed in QAR and stored as integer fils. Every box holds the RAW string until save so
 * a half-typed "450." survives, and parsePriceStrict decides what it means — crucially returning
 * null, not 0, for anything unclear. The old parser answered 0 to an empty box, which meant a
 * cleared price silently shipped a QAR 0.00 product.
 */
export function VariantGrid({
  productId,
  variants,
  totalQty,
}: {
  productId: string;
  variants: AdminVariant[];
  totalQty: number;
}) {
  const router = useRouter();
  const { can } = usePermissions();
  // Two different permissions live in this one panel: quantities are inventory, prices and the
  // total are product data. `staff` holds the first and not the second, so the grid offers each
  // half only to someone who can actually save it — rather than letting them type into a box and
  // eat a raw "forbidden" after the other half has already been written.
  const canPrice = can("products:write");
  const canStock = can("inventory:write");

  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [total, setTotal] = useState(String(totalQty));
  const [stock, setStock] = useState<Record<string, number>>(() => Object.fromEntries(variants.map((v) => [v.id, v.stock])));
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(variants.map((v) => [v.id, filsToPriceInput(v.price)])));
  /** Cells whose typed price failed to parse, painted red after a rejected save. */
  const [invalid, setInvalid] = useState<Record<string, true>>({});
  /** Draft-only bulk boxes: one per colour, plus one for the whole product. */
  const [colorBulk, setColorBulk] = useState<Record<string, string>>({});
  const [allBulk, setAllBulk] = useState("");

  const locked = busy || pending;

  /**
   * Resync the draft whenever the server sends different rows.
   *
   * router.refresh() merges a fresh RSC payload but deliberately KEEPS client state, so the
   * useState initialisers above run exactly once per mount and never again. That is what used to
   * leave a typed-but-unsaved price sitting in the box looking saved until a full page reload.
   * Comparing a signature of the server's own values and resetting during render is React's
   * documented way to adjust state on prop change — no effect, no extra paint.
   */
  const signature = useMemo(
    () => `${totalQty}#${variants.map((v) => `${v.id}:${v.stock}:${v.price}`).join("|")}`,
    [variants, totalQty],
  );
  const [syncedTo, setSyncedTo] = useState(signature);
  if (syncedTo !== signature) {
    setSyncedTo(signature);
    setStock(Object.fromEntries(variants.map((v) => [v.id, v.stock])));
    setPrices(Object.fromEntries(variants.map((v) => [v.id, filsToPriceInput(v.price)])));
    setTotal(String(totalQty));
    setInvalid({});
  }

  // group by colour, sizes in canonical order
  const groups = useMemo(() => {
    const byColor = new Map<string, { hex: string | null; rows: AdminVariant[] }>();
    for (const v of variants) {
      const g = byColor.get(v.color) ?? { hex: v.colorHex, rows: [] };
      g.rows.push(v);
      byColor.set(v.color, g);
    }
    for (const g of byColor.values()) g.rows.sort((a, b) => sortSizes([a.size, b.size])[0] === a.size ? -1 : 1);
    return byColor;
  }, [variants]);

  const sum = Object.values(stock).reduce((s, n) => s + (n || 0), 0);
  const totalNum = Math.max(0, Math.round(Number(total) || 0));

  const priceDirty = (v: AdminVariant) => canPrice && parsePriceStrict(prices[v.id] ?? "") !== v.price;
  const stockDirty = (v: AdminVariant) => canStock && (stock[v.id] ?? 0) !== v.stock;
  const totalDirty = canPrice && totalNum !== totalQty;
  // An unparseable price counts as dirty (null !== a number), so Save enables and explains itself
  // instead of sitting grey with no reason — the failure mode this rewrite exists to remove.
  const dirtyCount = variants.filter((v) => priceDirty(v) || stockDirty(v)).length + (totalDirty ? 1 : 0);

  /** Fill a set of price boxes from a bulk entry. Draft only — nothing is written until Save. */
  const applyBulk = (raw: string, rows: AdminVariant[], clear: () => void) => {
    const fils = parsePriceStrict(raw);
    if (fils === null) return toast.error(`That is not a price. ${PRICE_INPUT_HINT}`);
    const text = filsToPriceInput(fils);
    setPrices((p) => ({ ...p, ...Object.fromEntries(rows.map((v) => [v.id, text])) }));
    setInvalid((m) => {
      const next = { ...m };
      for (const v of rows) delete next[v.id];
      return next;
    });
    clear();
    toast.info(`${rows.length} price${rows.length === 1 ? "" : "s"} set to ${formatMoney(fils)} — press Save to apply`);
  };

  /**
   * The one save. Validate everything first and write nothing if any price is unclear, then the
   * three writes in order, each caught on its own so a later failure cannot erase what an earlier
   * one achieved. Prices go first: they are what the owner came here for, and putting them first
   * means a half-failed save can never reproduce the old bug's exact shape ("quantities saved,
   * prices quietly gone").
   */
  const save = async () => {
    const bad = variants.filter((v) => priceDirty(v) && parsePriceStrict(prices[v.id] ?? "") === null);
    if (bad.length) {
      setInvalid(Object.fromEntries(bad.map((v) => [v.id, true as const])));
      const first = `${bad[0].color} / ${bad[0].size}`;
      toast.error(
        bad.length === 1
          ? `${first} has no valid price, so nothing was saved. ${PRICE_INPUT_HINT}.`
          : `${bad.length} prices are not valid (${first} and ${bad.length - 1} more), so nothing was saved. ${PRICE_INPUT_HINT}.`,
        { duration: 10_000 },
      );
      return;
    }
    setInvalid({});

    const priceRows = variants
      .filter(priceDirty)
      .map((v) => ({ id: v.id, price: parsePriceStrict(prices[v.id] ?? "") as number }));
    const stockRows = variants.filter(stockDirty).map((v) => ({ id: v.id, stock: stock[v.id] ?? 0 }));

    if (!priceRows.length && !stockRows.length && !totalDirty) return toast.info("Nothing to save");

    // The sizes may now add up past the advisory total. Only offer to raise it to someone who can
    // actually write it; everyone else is told plainly rather than handed a "forbidden".
    let nextTotal = totalNum;
    if (sum > totalNum && canPrice) {
      if (!confirm(`The sizes add up to ${sum}, above the product total of ${totalNum}. Raise the total to ${sum}?`)) return;
      nextTotal = sum;
    }

    setBusy(true);
    const done: string[] = [];
    const failed: string[] = [];
    try {
      if (priceRows.length) {
        try {
          await setVariantPrices(productId, priceRows);
          done.push(`${priceRows.length} price${priceRows.length === 1 ? "" : "s"}`);
          setPrices((p) => ({ ...p, ...Object.fromEntries(priceRows.map((r) => [r.id, filsToPriceInput(r.price)])) }));
        } catch (e) {
          failed.push(`prices (${e instanceof Error ? e.message : "failed"})`);
        }
      }
      if (stockRows.length) {
        try {
          await setVariantStock(productId, stockRows);
          done.push(`${stockRows.length} quantit${stockRows.length === 1 ? "y" : "ies"}`);
        } catch (e) {
          failed.push(`quantities (${e instanceof Error ? e.message : "failed"})`);
        }
      }
      if (nextTotal !== totalQty && canPrice) {
        try {
          await setProductTotal(productId, nextTotal);
          setTotal(String(nextTotal));
        } catch (e) {
          failed.push(`total (${e instanceof Error ? e.message : "failed"})`);
        }
      }

      if (!failed.length) {
        toast.success(`Saved ${done.join(" and ")}`);
      } else if (done.length) {
        toast.error(`Saved ${done.join(" and ")}, but ${failed.join("; ")}.`, { duration: 10_000 });
      } else {
        toast.error(`Nothing was saved — ${failed.join("; ")}.`, { duration: 10_000 });
      }

      if (sum > totalNum && !canPrice) {
        toast.warning(`The sizes now add up to ${sum}, above the total of ${totalNum}. Ask an admin to raise it.`, { duration: 10_000 });
      }
    } finally {
      setBusy(false);
      // Always refresh, success or failure: on failure this pulls real DB state so the grid shows
      // what actually landed rather than the owner's optimistic draft.
      startTransition(() => router.refresh());
    }
  };

  const deleteColor = async (color: string, rows: AdminVariant[]) => {
    if (!confirm(`Delete all ${rows.length} "${color}" variants?`)) return;
    setBusy(true);
    try {
      await deleteVariants(productId, rows.map((v) => v.id));
      toast.success("Colour deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
      startTransition(() => router.refresh());
    }
  };

  if (!variants.length) {
    return (
      <Panel className="p-5">
        <SectionLabel className="mb-1">Variants &amp; quantities</SectionLabel>
        <p className="text-[13px] text-faint">No variants yet — add colours and sizes in the panel above.</p>
      </Panel>
    );
  }

  const saveLabel = canPrice && canStock ? "Save changes" : canPrice ? "Save prices" : "Save quantities";

  return (
    <Panel className="space-y-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionLabel>Variants &amp; quantities</SectionLabel>
        <div className="flex flex-wrap items-end gap-3">
          {canPrice && (
            <label className="block">
              <SectionLabel>Set every price</SectionLabel>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="decimal"
                  className={input}
                  value={allBulk}
                  disabled={locked}
                  placeholder="e.g. 950"
                  onChange={(e) => setAllBulk(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyBulk(allBulk, variants, () => setAllBulk(""));
                    }
                  }}
                />
                <Button size="sm" variant="outline" disabled={locked || !allBulk.trim()} onClick={() => applyBulk(allBulk, variants, () => setAllBulk(""))}>
                  Apply to all {variants.length}
                </Button>
              </div>
            </label>
          )}
          <label className="block">
            <SectionLabel>Total quantity</SectionLabel>
            <input
              type="number"
              min={0}
              className={input}
              value={total}
              readOnly={!canPrice}
              disabled={locked}
              title={canPrice ? undefined : "Only an admin can change the product total"}
              onChange={(e) => setTotal(e.target.value)}
            />
          </label>
          <p className={cn("pb-1.5 text-[12px]", sum > totalNum ? "text-danger" : "text-faint")}>
            sizes sum to <b className="text-secondary">{sum}</b> / {totalNum}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {[...groups.entries()].map(([color, { hex, rows }]) => (
          <div key={color} className="border border-edge">
            <div className="flex flex-wrap items-center gap-2 border-b border-edge px-3 py-2">
              <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-edge" style={{ background: hex ?? "#000" }} />
              <span className="text-[13px] font-medium text-foreground">{color}</span>
              {canPrice && (
                <span className="ms-3 flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    className={cn(input, "w-20")}
                    value={colorBulk[color] ?? ""}
                    disabled={locked}
                    placeholder="price"
                    onChange={(e) => setColorBulk((b) => ({ ...b, [color]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyBulk(colorBulk[color] ?? "", rows, () => setColorBulk((b) => ({ ...b, [color]: "" })));
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={locked || !(colorBulk[color] ?? "").trim()}
                    onClick={() => applyBulk(colorBulk[color] ?? "", rows, () => setColorBulk((b) => ({ ...b, [color]: "" })))}
                  >
                    Apply to {rows.length} size{rows.length === 1 ? "" : "s"}
                  </Button>
                </span>
              )}
              <button type="button" disabled={locked} onClick={() => deleteColor(color, rows)} className="ms-auto text-faint hover:text-danger" aria-label="Delete colour"><Trash2 size={14} /></button>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.1em] text-faint">
                  <th className="p-1.5 text-start">Size</th>
                  <th className="p-1.5 text-end">Quantity</th>
                  <th className="p-1.5 text-end">Price (QAR)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className="border-t border-edge/60">
                    <td className="p-1.5 text-foreground">{v.size}</td>
                    <td className="p-1.5 text-end">
                      {canStock ? (
                        <input type="number" min={0} className={cn(input, "w-20 text-end", (stock[v.id] ?? 0) > 0 && "border-accent/40")}
                          value={stock[v.id] ?? 0}
                          disabled={locked}
                          onChange={(e) => setStock((s) => ({ ...s, [v.id]: Math.max(0, Math.round(Number(e.target.value) || 0)) }))} />
                      ) : (
                        <span className="pe-2 text-faint">{v.stock}</span>
                      )}
                    </td>
                    <td className="p-1.5 text-end">
                      {canPrice ? (
                        // type="text", not type="number": a number input reports "" for anything the
                        // browser dislikes, so the component could not tell a cleared box from a
                        // mistyped one and saved both as QAR 0.00. It also stops the scroll wheel
                        // silently changing a price.
                        <input type="text" inputMode="decimal"
                          className={cn(input, "w-24 text-end", invalid[v.id] && "border-danger")}
                          value={prices[v.id] ?? ""}
                          disabled={locked}
                          aria-invalid={invalid[v.id] ? true : undefined}
                          aria-label={`Price for ${v.color} ${v.size}`}
                          onChange={(e) => {
                            setPrices((p) => ({ ...p, [v.id]: e.target.value }));
                            setInvalid((m) => { if (!m[v.id]) return m; const n = { ...m }; delete n[v.id]; return n; });
                          }} />
                      ) : (
                        <span className="pe-2 text-faint">{formatMoney(v.price)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="text-[11px] text-faint">
          Prices are in QAR — 450 = QAR 450.00, 450.50 to include fils. A blank or unreadable price is
          refused, never saved as zero. A size at 0 shows greyed-out on the site.
        </p>
        {dirtyCount > 0 && (
          <span className="text-[12px] text-secondary">{dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}</span>
        )}
        {(canPrice || canStock) && (
          <Button variant="primary" disabled={locked || dirtyCount === 0} title={dirtyCount === 0 ? "No changes yet" : undefined} onClick={save}>
            {busy ? "Saving…" : saveLabel}
          </Button>
        )}
      </div>
    </Panel>
  );
}
