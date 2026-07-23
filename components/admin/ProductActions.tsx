"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { Button, ConfirmDialog } from "./ui";
import { Can } from "./ui/PermissionGate";
import { duplicateProduct, deleteProduct } from "@/lib/actions/products";

export function ProductActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const dup = async () => {
    setBusy(true);
    try {
      const r = await duplicateProduct(id);
      toast.success("Product duplicated");
      router.push(`/admin/products/${r.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    await deleteProduct(id);
    toast.success("Product deleted");
    router.push("/admin/products");
  };

  return (
    <>
      <Can permission="products:write">
        <Button variant="outline" onClick={dup} disabled={busy}><Copy size={14} /> Duplicate</Button>
      </Can>
      <Can permission="products:delete">
        <Button variant="danger" onClick={() => setConfirm(true)} disabled={busy}><Trash2 size={14} /> Delete</Button>
      </Can>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={del}
        title="Delete product?"
        body={`This permanently deletes “${title}” and all its variants and images.`}
        confirmLabel="Delete"
        danger
      />
    </>
  );
}
