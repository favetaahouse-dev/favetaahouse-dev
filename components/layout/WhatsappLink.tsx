"use client";

import Image from "next/image";
import { trackMeta } from "@/lib/meta/fbq";

/**
 * The WhatsApp anchor, split out as a client component purely so the click can be tracked.
 *
 * For a Doha boutique this is a real sales channel, not a support link — a lot of orders start
 * as a WhatsApp message about sizing or fabric. Meta's standard `Contact` event is exactly this,
 * and it lets campaigns be optimised for people who actually reach out.
 *
 * Browser-only: there is no server moment for an outbound link click, and relaying it would mean
 * a Vercel invocation per tap for a low-value event.
 */
export function WhatsappLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      onClick={() => trackMeta("Contact")}
      // Mirrors CurrencySwitcher on the opposite gutter, clearing the fixed bottom bar.
      className="fixed bottom-[calc(1rem+var(--bottom-bar-clear))] end-5 z-30 transition-transform hover:scale-105"
    >
      <Image
        src="/assets/brand/whatsapp.png"
        alt="WhatsApp"
        width={50}
        height={50}
        className="h-11 w-11 md:h-12 md:w-12"
      />
    </a>
  );
}
