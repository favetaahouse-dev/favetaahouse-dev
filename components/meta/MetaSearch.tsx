"use client";

import { useEffect, useRef } from "react";
import { trackMeta } from "@/lib/meta/fbq";
import { searchPayload } from "@/lib/meta/events";

/**
 * Meta Search, fired from the results component so the query AND the result handles are both
 * known — a search that returned nothing is exactly as interesting as one that returned twenty,
 * and for a fashion catalogue it is the more actionable of the two (it names demand the store
 * isn't meeting).
 *
 * Keyed on the query so typing a new search fires again, but a re-render does not.
 * Browser-only: relaying every keystroke-driven search to the Conversions API would cost a
 * server invocation per search for a low-weight signal.
 */
export function MetaSearch({ query, handles }: { query: string; handles: string[] }) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (!q || last.current === q) return;
    last.current = q;
    trackMeta("Search", searchPayload(q, handles));
  }, [query, handles]);
  return null;
}
