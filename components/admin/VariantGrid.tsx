"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Lock } from "lucide-react";
import { Button, IconButton, Panel, PanelHeader, FieldLabel, EmptyState, ConfirmDialog, fieldInput } from "./ui";
import { setVariantStock, setVariantPrices, setProductTotal, deleteVariants } from "@/lib/actions/products";
import { sortSizes } from "@/lib/variant-options";
import { usePermissions } from "@/lib/rbac/use-permissions";
import { parsePriceStrict, filsToPriceInput, formatMoney, PRICE_INPUT_HINT } from "@/lib/money";
import type { AdminVariant } from "@/lib/data/admin-catalog";
import { cn } from "@/lib/utils";

const input = cn(fieldInput, "w-24 px-2 py-1");

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
  /** The colour a ConfirmDialog is currently asking about. Null when the dialog is closed. */
  const [pendingDelete, setPendingDelete] = useState<{ color: string; rows: AdminVariant[] } | null>(null);

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

  /**
   * The gate moved out to a ConfirmDialog — the same one ProductActions uses for "Delete
   * product", so the console no longer confirms destruction two visually unrelated ways.
   * Safe to convert where the raise-the-total confirm() in save() is not: this function's
   * entire body after the prompt IS the action, so there is no sequence to split.
   *
   * The try/catch stays load-bearing. ConfirmDialog.run() skips its own onClose when
   * onConfirm throws, so swallowing here is what guarantees the dialog always closes.
   */
  const deleteColor = async (rows: AdminVariant[]) => {
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

  const deleteDialog = (
    <ConfirmDialog
      open={pendingDelete !== null}
      onClose={() => setPendingDelete(null)}
      onConfirm={() => deleteColor(pendingDelete?.rows ?? [])}
      title="Delete this colour?"
      body={
        pendingDelete
          ? `This removes all ${pendingDelete.rows.length} “${pendingDelete.color}” variants and the quantities recorded against them.`
          : undefined
      }
      confirmLabel="Delete colour"
      danger
    />
  );

  // Stays below every hook — including the resync above and the useState/useTransition before
  // it. Hoisting this return is what would make deleting the last colour throw "Rendered fewer
  // hooks than expected", because the component would take a different hook path on that render.
  if (!variants.length) {
    return (
      <>
        <Panel>
          <PanelHeader title="Prices &amp; quantities" />
          <EmptyState
            title="No variants yet"
            description="Pick colours and sizes in the panel above, then press Generate. They appear here with a box for each quantity and price."
          />
        </Panel>
        {/* Rendered in this branch too: deleting the LAST colour lands the next render here, and
            a dialog that unmounts mid-confirm would strand its busy state. */}
        {deleteDialog}
      </>
    );
  }

  const saveLabel = canPrice && canStock ? "Save prices & quantities" : canPrice ? "Save prices" : "Save quantities";
  const overTotal = sum > totalNum;

  return (
    <Panel>
      <PanelHeader
        title="Prices &amp; quantities"
        description="Every colour and size that already exists. Editing here never creates or removes a variant — use the panel above for that."
      />

      {/* The bulk tools used to be crammed into the panel title's flex row, so a bulk overwrite
          of every price on the product sat at the same visual weight as the heading. Given their
          own bordered strip they read as tools, and the heading reads as a heading. */}
      <div className="flex flex-wrap items-end gap-4 border-b border-edge bg-canvas/40 px-5 py-3.5">
        {canPrice && (
          <label className="block">
            <FieldLabel hint="Fills every box below. Nothing is written until you save.">Set every price</FieldLabel>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="decimal"
                className={input}
                value={allBulk}
                disabled={locked}
                placeholder="e.g. 950"
                aria-label="Price to apply to every variant"
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
          <FieldLabel hint="An advisory figure on the product. It doesn't have to match the sizes.">
            Product total
          </FieldLabel>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              // readOnly, deliberately not disabled — the value stays selectable and readable.
              // It now LOOKS read-only too; the old signal was a title= tooltip, which never
              // renders on touch and only appears if you happen to hover the right box.
              className={cn(input, !canPrice && "border-edge bg-elevated text-secondary")}
              value={total}
              readOnly={!canPrice}
              disabled={locked}
              aria-label="Product total quantity"
              onChange={(e) => setTotal(e.target.value)}
            />
            {!canPrice && (
              <span className="inline-flex items-center gap-1 text-[11px] text-secondary">
                <Lock size={11} aria-hidden="true" /> Admin only
              </span>
            )}
          </div>
        </label>
        <p className={cn("pb-2 text-[12px]", overTotal ? "text-warn" : "text-secondary")}>
          Sizes add up to <b className="font-medium text-foreground">{sum}</b> of {totalNum}
        </p>
      </div>

      <div className="space-y-3 p-5">
        {[...groups.entries()].map(([color, { hex, rows }]) => (
          <div key={color} className="border border-edge">
            <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-canvas/40 px-3 py-2">
              <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-field" style={{ background: hex ?? "#000" }} />
              <h3 className="text-[13px] font-medium text-foreground">{color}</h3>
              {canPrice && (
                <span className="ms-3 flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    className={cn(input, "w-20")}
                    value={colorBulk[color] ?? ""}
                    disabled={locked}
                    placeholder="price"
                    aria-label={`Price to apply to every ${color} size`}
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
              {/* IconButton, not a bare 14px glyph: this is the most destructive control on the
                  panel and it had no focus ring, no resting affordance and — being N buttons all
                  named "Delete colour" — no way to tell which one you were on. */}
              <IconButton
                type="button"
                disabled={locked}
                onClick={() => setPendingDelete({ color, rows })}
                className="ms-auto hover:text-danger"
                aria-label={`Delete all ${rows.length} ${color} variants`}
              >
                <Trash2 size={15} />
              </IconButton>
            </div>
            <table className="w-full text-[13px]">
              {/* There is one table per colour with identical headers, and the colour name sits
                  outside them — so without this a screen reader announced "Size, Quantity, Price"
                  three times with no way to tell which colour it was in. */}
              <caption className="sr-only">{color} — size, quantity and price</caption>
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.1em] text-secondary">
                  <th scope="col" className="p-1.5 text-start font-medium">Size</th>
                  <th scope="col" className="p-1.5 text-end font-medium">Quantity</th>
                  <th scope="col" className="p-1.5 text-end font-medium">Price (QAR)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const rowDirty = priceDirty(v) || stockDirty(v);
                  const outOfStock = (stock[v.id] ?? 0) === 0;
                  return (
                    <tr key={v.id} className="border-t border-edge/60">
                      {/* th scope=row so the size names its own cells. font-normal + text-start
                          because <th> defaults to bold and centred. */}
                      <th scope="row" className="relative p-1.5 text-start font-normal text-foreground">
                        {/* Absolutely positioned so it cannot squeeze the fixed-width inputs.
                            "N unsaved changes" told you how many but never which. */}
                        {rowDirty && (
                          <span
                            title="Unsaved"
                            className="absolute start-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent"
                          />
                        )}
                        <span className="ps-3">{v.size}</span>
                      </th>
                      <td className="p-1.5 text-end">
                        <div className="flex items-center justify-end gap-2">
                          {/* The zero case is the one worth flagging. The old decoration did the
                              opposite — it outlined every row that had stock, so in a healthy
                              table nearly everything was highlighted and the signal said nothing.
                              It also used border colour, which already means focus and invalid. */}
                          {canStock && outOfStock && (
                            <span className="text-[11px] text-warn">hidden on site</span>
                          )}
                          {canStock ? (
                            <input type="number" min={0} className={cn(input, "w-20 text-end")}
                              value={stock[v.id] ?? 0}
                              disabled={locked}
                              aria-label={`Quantity for ${v.color} ${v.size}`}
                              onChange={(e) => setStock((s) => ({ ...s, [v.id]: Math.max(0, Math.round(Number(e.target.value) || 0)) }))} />
                          ) : (
                            <span className="pe-2 text-foreground">{v.stock}</span>
                          )}
                        </div>
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
                          <span className="pe-2 text-foreground">{formatMoney(v.price)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t border-edge px-5 py-3.5">
        {/* Announce the confirm rather than replace it. save() still prompts with a native
            confirm() before it writes anything; what was missing was any warning that pressing
            Save would ask a question at all. */}
        {overTotal && canPrice && (
          <p className="text-[12px] text-warn">
            The sizes add up to <b className="font-medium">{sum}</b>, above the product total of{" "}
            <b className="font-medium">{totalNum}</b>. Saving will ask whether to raise the total to {sum}.
          </p>
        )}
        <p className="text-[12px] leading-relaxed text-secondary">
          Prices are in QAR — 450 = QAR 450.00, 450.50 to include fils. A blank or unreadable price is
          refused, never saved as zero. A size at 0 is hidden on the site.
        </p>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {dirtyCount > 0 && (
            <span className="text-[12px] text-secondary">
              <b className="font-medium text-foreground">{dirtyCount}</b> unsaved change{dirtyCount === 1 ? "" : "s"}
            </span>
          )}
          {(canPrice || canStock) && (
            <Button variant="primary" disabled={locked || dirtyCount === 0} title={dirtyCount === 0 ? "No changes yet" : undefined} onClick={save}>
              {busy ? "Saving…" : pending ? "Refreshing…" : saveLabel}
            </Button>
          )}
        </div>
      </div>
      {deleteDialog}
    </Panel>
  );
}
