import { DEFAULT_MEASURE_FIELDS, serializeMeasureFields } from "@/lib/measurements";

// "list" edits a comma-joined string as removable chips (sizes, lengths).
// "measures" edits the made-to-order measurement schema as repeatable rows. Its value is a
// JSON string rather than a nested object so that a content row stays a flat
// Record<string, string> — the same accommodation home.gallery makes by newline-joining its
// URLs. Widening the value type instead would ripple through getContent() and every one of its
// callers to buy nothing: the measurement list has its own typed reader either way.
export type FieldKind =
  | "text" | "textarea" | "bi" | "bitext" | "number" | "toggle" | "list" | "measures";
export type Field = { key: string; label: string; kind: FieldKind; hint?: string };

export const SECTIONS = ["site-settings", "commerce", "home", "variant-options", "made-to-order"] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_TITLES: Record<Section, string> = {
  "site-settings": "Site Settings",
  commerce: "Commerce & Payments",
  home: "Home Page",
  "variant-options": "Variant Options",
  "made-to-order": "Made to Order",
};

export const FIELD_SCHEMA: Record<Section, Field[]> = {
  "site-settings": [
    { key: "contactEmail", label: "Contact email", kind: "text" },
    { key: "whatsapp", label: "WhatsApp number", kind: "text", hint: "Digits only, with country code. Shown as the floating chat button." },
    { key: "storeLocation", label: "Store location", kind: "text", hint: "Shown in the order-email footer." },
    { key: "instagram", label: "Instagram URL", kind: "text", hint: "Leave any social blank to hide its icon in the footer." },
    { key: "facebook", label: "Facebook URL", kind: "text" },
    { key: "tiktok", label: "TikTok URL", kind: "text" },
    { key: "youtube", label: "YouTube URL", kind: "text" },
    { key: "announcement", label: "Announcement bar", kind: "bi" },
  ],
  commerce: [
    { key: "shippingFee", label: "Shipping fee (QAR)", kind: "number", hint: "Flat delivery charge added at checkout. 0 = free shipping." },
    { key: "freeShippingThreshold", label: "Free shipping over (QAR)", kind: "number", hint: "Orders at or above this subtotal ship free. 0 = disabled." },
    { key: "taxRate", label: "Tax rate (%)", kind: "number", hint: "Percentage applied to the order (after discount). 0 = no tax." },
    { key: "taxLabel", label: "Tax line label", kind: "bi" },
    { key: "emailEnabled", label: "Send order confirmation emails", kind: "toggle", hint: "Requires RESEND_API_KEY to be set in the environment." },
    { key: "emailSenderName", label: "Email sender name", kind: "text" },
    { key: "emailFromAddress", label: "Email from address", kind: "text", hint: "Must be on a domain you have verified with Resend — an unverified address is rejected and order emails fail silently." },
    { key: "emailReplyTo", label: "Email reply-to address", kind: "text" },
  ],
  // Every field here is read by a homepage component — see components/home/TrendyTabs.tsx
  // and components/home/StoryBand.tsx. Blank falls back to the translated default, so an
  // owner who never opens this page still gets a complete homepage in both languages.
  home: [
    { key: "trendyTitle", label: "Catalogue section title", kind: "bi", hint: "Heading above the category tabs and product grid." },
    { key: "storyTitle", label: "Story section title", kind: "bi" },
    { key: "storyHeading", label: "Story heading", kind: "bi", hint: "The smaller headline beside the image." },
    { key: "storyLead", label: "Story lead paragraph", kind: "bitext" },
    { key: "storyBody", label: "Story second paragraph", kind: "bitext", hint: "Optional. Leave blank to show only the lead." },
    { key: "storyCta", label: "Story button label", kind: "bi" },
    { key: "storyCtaHref", label: "Story button link", kind: "text", hint: "A storefront path, e.g. /collections/all" },
    { key: "storyImage", label: "Story image URL", kind: "text", hint: "Leave blank to use the packaged image." },
  ],
  "variant-options": [
    { key: "sizes", label: "Sizes", kind: "list", hint: "The size buttons a product can offer. Order here is the order shown on the product page." },
    { key: "lengths", label: "Lengths", kind: "list", hint: "Whole numbers, e.g. hem length in inches. These become the length chips when a product's variants use them." },
  ],
  // Ready-to-wear is sized off the rail; made-to-order is cut to a body. This section is the
  // form that body is described in — and a product picks which of these fields apply to it.
  "made-to-order": [
    {
      key: "measureFields", label: "Measurement fields", kind: "measures",
      hint: "The form a made-to-order shopper fills in. Minimum and maximum are always in centimetres — the shopper's cm/inch switch converts on the way in.",
    },
    { key: "leadMinDays", label: "Production time — from (days)", kind: "number", hint: "Used by any product that doesn't set its own lead time." },
    { key: "leadMaxDays", label: "Production time — to (days)", kind: "number" },
    { key: "unitInches", label: "Show inches by default", kind: "toggle", hint: "Off = centimetres. Shoppers can switch either way on the product page." },
    { key: "intro", label: "Measurement form intro", kind: "bitext", hint: "A line above the fields. Blank uses the built-in translation." },
    { key: "guide", label: "How to measure", kind: "bitext", hint: "Shown in the product page's details panel. A product can override it with its own." },
    { key: "guideImage", label: "How-to-measure diagram URL", kind: "text" },
    { key: "notesLabel", label: "Notes box label", kind: "bi" },
    { key: "returnsNote", label: "Made-to-order returns note", kind: "text", hint: "Printed on the receipt when the order contains a made-to-order piece. English — the receipt is English." },
  ],
};

export const DEFAULT_CONTENT: Record<Section, Record<string, string>> = {
  "site-settings": {
    contactEmail: "favetaahouse@gmail.com",
    whatsapp: "97450099331",
    storeLocation: "Doha, Qatar",
    instagram: "",
    facebook: "",
    tiktok: "",
    youtube: "",
    announcement: "",
    announcement_ar: "",
  },
  commerce: {
    shippingFee: "0",
    freeShippingThreshold: "0",
    taxRate: "0",
    taxLabel: "Tax", taxLabel_ar: "ضريبة",
    emailEnabled: "true",
    emailSenderName: "FAVETAA",
    emailFromAddress: "favetaahouse@gmail.com",
    emailReplyTo: "favetaahouse@gmail.com",
  },
  home: {
    // ── Editable copy (Admin → Content → Home Page) ──
    // Blank on purpose: each component falls back to its i18n string, so these only ever
    // hold a deliberate override. A baked-in English default here would silently win over
    // the Arabic translation on /ar.
    trendyTitle: "", trendyTitle_ar: "",
    storyTitle: "", storyTitle_ar: "",
    storyHeading: "", storyHeading_ar: "",
    storyLead: "", storyLead_ar: "",
    storyBody: "", storyBody_ar: "",
    storyCta: "", storyCta_ar: "",
    storyCtaHref: "",
    storyImage: "",
    // ── Hero media (Admin → Media) ──
    // Every one of these defaults to BLANK on purpose. "No hero video" has to be a state the
    // homepage can actually be in, or the admin's Remove button has nowhere to land: a baked-in
    // default here would resurrect the clip the owner had just deleted, on the next cache miss.
    // With these empty the hero falls back to a plain band — see components/home/Hero.tsx.
    heroVideo: "",
    // Served under 768px. Blank reuses heroVideo, so a single upload still works everywhere.
    heroVideoMobile: "",
    // The footage's mean colour, painted in the frame the HTML parses so the hero is never black
    // while the clip is still in flight. It is the ONLY thing under the video — there is no poster
    // still — so it is also what reduced-motion visitors see. Not typed by hand: it is measured
    // off the uploaded video in the browser (components/admin/MediaManager.tsx), so it cannot go
    // stale against footage it no longer matches.
    heroBg: "",
    // Homepage gallery — newline-joined image URLs (edited in Admin → Media).
    gallery: "/assets/home/gallery-1.jpg\n/assets/home/gallery-2.jpg\n/assets/home/gallery-3.jpg\n/assets/home/gallery-4.jpg",
  },
  // Union of sizes in use (XS/S/M/L/One Size) + the ones you asked for (XL/XXL). Lengths match
  // the reference storefront (50–61). Edited in the admin; the product page still only offers a
  // value if the product actually has variants for it.
  "variant-options": {
    sizes: "XS, S, M, L, XL, XXL, One Size",
    lengths: "50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62",
  },
  "made-to-order": {
    // The one field here with a real default rather than a blank: an empty measurement form is
    // an unsellable product, so the house list ships ready to use. See lib/measurements.ts.
    measureFields: serializeMeasureFields(DEFAULT_MEASURE_FIELDS),
    leadMinDays: "14",
    leadMaxDays: "21",
    // "false" spelled out, not "": ToggleFieldRow reads on = value !== "false", so a blank here
    // would quietly make inches the default unit on a fresh install.
    unitInches: "false",
    // Blank on purpose — each falls back to its i18n string, so /ar is not overwritten by an
    // English default. Components use || not ??. Same rule as the home section above.
    intro: "", intro_ar: "",
    guide: "", guide_ar: "",
    guideImage: "",
    notesLabel: "", notesLabel_ar: "",
    returnsNote: "",
  },
};
