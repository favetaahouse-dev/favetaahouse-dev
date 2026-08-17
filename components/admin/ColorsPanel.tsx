"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  ConfirmDialog,
  IconButton,
  Panel,
  PanelHeader,
  fieldInput,
} from "@/components/admin/ui";
import { setProductColors, deleteProductColor } from "@/lib/actions/products";
import { MAX_COLORS } from "@/lib/variant-options";
import { cn } from "@/lib/utils";

export type AdminColor = {
  id: string | null;
  name: string;
  nameAr: string;
  hex: string;
  variantCount: number;
};

/**
 * The product's colour list.
 *
 * Its own panel rather than a step inside the variant matrix, because colour is the one axis
 * BOTH modes share: a made-to-order product has colours and no size grid to hide them in. The
 * matrix now reads this list instead of defining it.
 *
 * Rows carry their id so a rename is a rename. Saving by name alone — which is all the import
 * path can do — would turn "Black → Jet Black" into a second colour and strand every variant on
 * the first one.
 */
export function ColorsPanel({
  productId,
  initial,
  canEdit,
}: {
  productId: string;
  initial: AdminColor[];
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<AdminColor[]>(initial);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<AdminColor | null>(null);

  const patch = (i: number, p: Partial<AdminColor>) =>
    setRows((s) => s.map((r, n) => (n === i ? { ...r, ...p } : r)));

  function addRow() {
    if (rows.length >= MAX_COLORS) {
      toast.error(`A product can have at most ${MAX_COLORS} colours.`);
      return;
    }
    setRows((s) => [...s, { id: null, name: "", nameAr: "", hex: "#000000", variantCount: 0 }]);
  }

  async function save() {
    const clean = rows.filter((r) => r.name.trim());
    if (!clean.length) {
      toast.error("Add at least one colour.");
      return;
    }
    setSaving(true);
    try {
      await setProductColors(
        productId,
        clean.map((r) => ({
          id: r.id ?? undefined,
          name: r.name.trim(),
          nameAr: r.nameAr.trim() || null,
          hex: r.hex || null,
        })),
      );
      toast.success("Colours saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save colours");
    }
    setSaving(false);
  }

  async function remove(row: AdminColor) {
    setConfirm(null);
    // A row that was never saved has nothing to delete server-side.
    if (!row.id) {
      setRows((s) => s.filter((r) => r !== row));
      return;
    }
    try {
      await deleteProductColor(productId, row.id);
      setRows((s) => s.filter((r) => r.id !== row.id));
      toast.success(`Removed ${row.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove colour");
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Colours"
        description="Shown as swatches on the product page, in both made-to-order and ready-to-wear."
      />
      <div className="space-y-2 p-5">
        {rows.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2">
            <input
              type="color"
              value={r.hex || "#000000"}
              onChange={(e) => patch(i, { hex: e.target.value })}
              disabled={!canEdit}
              aria-label={`${r.name || "Colour"} swatch`}
              className="h-9 w-10 shrink-0 cursor-pointer border border-field bg-transparent"
            />
            <input
              value={r.name}
              onChange={(e) => patch(i, { name: e.target.value })}
              disabled={!canEdit}
              placeholder="Colour name"
              className={cn(fieldInput, "min-w-[8rem] flex-1")}
            />
            <input
              value={r.nameAr}
              onChange={(e) => patch(i, { nameAr: e.target.value })}
              disabled={!canEdit}
              placeholder="العربية"
              dir="rtl"
              lang="ar"
              className={cn(fieldInput, "min-w-[8rem] flex-1")}
            />
            {r.variantCount > 0 && (
              <span className="text-xs text-secondary">{r.variantCount} size(s)</span>
            )}
            {canEdit && (
              <IconButton aria-label={`Remove ${r.name || "colour"}`} onClick={() => setConfirm(r)}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            )}
          </div>
        ))}
        {canEdit && (
          <Button variant="outline" size="sm" onClick={addRow}>
            Add colour
          </Button>
        )}
      </div>
      {canEdit && (
        <div className="flex justify-end border-t border-edge px-5 py-3">
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save colours"}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={`Remove ${confirm?.name || "colour"}?`}
        // Named consequence, not a generic warning: variants.color_id cascades, so this takes
        // the colour's sizes and their stock with it.
        body={
          confirm?.variantCount
            ? `This also deletes its ${confirm.variantCount} size row(s) and their stock. This cannot be undone.`
            : "This cannot be undone."
        }
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          if (confirm) await remove(confirm);
        }}
        onClose={() => setConfirm(null)}
      />
    </Panel>
  );
}
