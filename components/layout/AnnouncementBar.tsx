/**
 * The storefront announcement bar — the missing consumer of the admin's
 * Announcements page (Admin → Announcements writes `announcement`/`announcement_ar`
 * into site-settings). Rendered in normal flow at the very top of the body so it
 * scrolls away with the page; the fixed Header offsets itself below it (see Header's
 * `announcementActive`/BAR_H). Empty message → nothing renders and the header sits at top.
 *
 * On a homepage that has hero media, app/globals.css floats it OVER the hero instead, via
 * `body:has([data-hero-full]) [data-announce]` — see that rule for why the switch is CSS and not
 * a prop. That is what the `data-announce` hook is for.
 *
 * The content row stays locked to BAR_H (34px) and the copy is single-line/truncated so the
 * header's offset stays exact — keep announcement messages short. The safe-area padding sits
 * OUTSIDE that row, so a notch adds height without breaking the arithmetic: the header's own
 * env() term in .site-header--bar absorbs exactly the same amount.
 */
export function AnnouncementBar({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div data-announce className="bg-ink pt-[env(safe-area-inset-top,0px)] text-white">
      <div className="flex h-[34px] items-center justify-center px-4 text-center">
        <p className="truncate text-[12px] tracking-[0.06em]">{text}</p>
      </div>
    </div>
  );
}
