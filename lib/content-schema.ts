export type FieldKind = "text" | "textarea" | "bi" | "bitext" | "number" | "toggle";
export type Field = { key: string; label: string; kind: FieldKind; hint?: string };

export const SECTIONS = ["site-settings", "commerce", "home", "about", "materials-colors", "contact"] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_TITLES: Record<Section, string> = {
  "site-settings": "Site Settings",
  commerce: "Commerce & Payments",
  home: "Home Page",
  about: "Our Story",
  "materials-colors": "Materials & Colors",
  contact: "Contact",
};

export const FIELD_SCHEMA: Record<Section, Field[]> = {
  "site-settings": [
    { key: "contactEmail", label: "Contact email", kind: "text" },
    { key: "whatsapp", label: "WhatsApp number", kind: "text" },
    { key: "instagram", label: "Instagram URL", kind: "text" },
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
    { key: "emailReplyTo", label: "Email reply-to address", kind: "text" },
  ],
  home: [
    { key: "shopSale", label: "Sale button", kind: "bi" },
    { key: "campaignTitle", label: "Campaign title", kind: "bi" },
    { key: "newsletterTitle", label: "Newsletter title", kind: "bi" },
    { key: "travelIntro", label: "Travel intro", kind: "bitext" },
  ],
  about: [
    { key: "storyTitle", label: "Story heading", kind: "bi" },
    { key: "story", label: "Brand story", kind: "bitext" },
  ],
  "materials-colors": [
    { key: "heading", label: "Heading", kind: "bi" },
    { key: "subtitle", label: "Subtitle", kind: "bi" },
  ],
  contact: [
    { key: "title", label: "Heading", kind: "bi" },
    { key: "intro", label: "Intro text", kind: "bitext" },
  ],
};

export const DEFAULT_CONTENT: Record<Section, Record<string, string>> = {
  "site-settings": {
    contactEmail: "customersupport@alessiaabaya.com",
    whatsapp: "97450099331",
    instagram: "https://www.instagram.com/alessia_abaya/",
    facebook: "https://www.facebook.com/alessia_abaya/",
    tiktok: "https://www.tiktok.com/@alessia_abaya",
    youtube: "https://www.youtube.com/channel/UCuBotgo0vssjtPkgJ539rlw",
    announcement: "",
    announcement_ar: "",
  },
  commerce: {
    shippingFee: "0",
    freeShippingThreshold: "0",
    taxRate: "0",
    taxLabel: "Tax", taxLabel_ar: "ضريبة",
    emailEnabled: "true",
    emailSenderName: "Alessia Abaya",
    emailReplyTo: "customersupport@alessiaabaya.com",
  },
  home: {
    shopSale: "Shop Sale", shopSale_ar: "تسوّق التخفيضات",
    campaignTitle: "Discover the Campaign", campaignTitle_ar: "اكتشفي الحملة",
    newsletterTitle: "Newsletter", newsletterTitle_ar: "النشرة البريدية",
    travelIntro: "Discover luxury travel abayas designed for comfort, versatility, and effortless elegance.",
    travelIntro_ar: "اكتشفي عبايات السفر الفاخرة المصممة للراحة والتنوّع والأناقة السهلة.",
    heroVideo: "/assets/video/hero.mp4",
    campaignVideo: "/assets/video/campaign.mp4",
  },
  about: {
    storyTitle: "Our Story", storyTitle_ar: "قصتنا",
    story: "Founded in 1982 in the heart of Doha, Alessia Abaya has become a house of timeless elegance.",
    story_ar: "تأسست في عام ١٩٨٢ في قلب الدوحة، أصبحت ALESSIA ABAYA داراً للأناقة الخالدة.",
  },
  "materials-colors": {
    heading: "Our Materials", heading_ar: "أقمشتنا",
    subtitle: "The finest materials and a palette that resonates with emotion",
    subtitle_ar: "أفخر الأقمشة ولوحة ألوان تلامس المشاعر",
  },
  contact: {
    title: "Customer Service", title_ar: "خدمة العملاء",
    intro: "Please fill in the form and include your reason for return or exchange, or chat with our WhatsApp agent.",
    intro_ar: "يرجى تعبئة النموذج مع ذكر سبب الإرجاع أو الاستبدال، أو التحدث مع وكيل واتساب.",
  },
};
