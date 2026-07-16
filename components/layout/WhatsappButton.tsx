import Image from "next/image";
import { getSiteSettings } from "@/lib/content";
import { WHATSAPP_NUMBER } from "@/lib/constants";

export async function WhatsappButton() {
  const settings = await getSiteSettings();
  const number = (settings.whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, "");
  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 end-5 z-30 transition-transform hover:scale-105"
    >
      <Image src="/assets/brand/whatsapp.png" alt="WhatsApp" width={50} height={50} className="h-11 w-11 md:h-12 md:w-12" />
    </a>
  );
}
