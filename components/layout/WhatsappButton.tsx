import { getWhatsappUrl } from "@/lib/content";
import { WhatsappLink } from "./WhatsappLink";

export async function WhatsappButton() {
  // No constants fallback: getContent already merges DEFAULT_CONTENT under the DB row,
  // so the default lives in one place rather than two.
  const href = await getWhatsappUrl();
  // The anchor itself is a client component so the tap can fire Meta's Contact event — the
  // number still comes from the CMS here, on the server.
  return <WhatsappLink href={href} />;
}
