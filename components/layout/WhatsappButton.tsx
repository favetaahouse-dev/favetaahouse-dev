import Image from "next/image";
import { getWhatsappUrl } from "@/lib/content";

export async function WhatsappButton() {
  // No constants fallback: getContent already merges DEFAULT_CONTENT under the DB row,
  // so the default lives in one place rather than two.
  const href = await getWhatsappUrl();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 end-5 z-30 transition-transform hover:scale-105"
    >
      <Image src="/assets/brand/whatsapp.png" alt="WhatsApp" width={50} height={50} className="h-11 w-11 md:h-12 md:w-12" />
    </a>
  );
}
