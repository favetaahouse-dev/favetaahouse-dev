export const TESTIMONIALS = [
  {
    name: "Fatima",
    location: "Proud owner of Silver Veil abaya",
    quote:
      "This abaya honestly feels like a piece of art. I love every little detail in it, and it's one of the most complimented abayas I've ever purchased.",
    handle: "5012a4959la1",
    rating: 5,
  },
  {
    name: "Noor",
    location: "United Kingdom",
    quote:
      "I purchased this abaya and couldn't be happier with it. The beige cream color looks very luxurious, and the fabric feels beautiful.",
    handle: "5012a5097",
    rating: 5,
  },
  {
    name: "Huda",
    location: "Riyadh, Saudi Arabia",
    quote: "رووعة العباية عالطبيعة جدااا عجبتني وتصلح للشتى",
    handle: "5012a4992hr1",
    rating: 5,
  },
  {
    name: "Sara",
    location: "Jeddah, Saudi Arabia",
    quote: "وايد حلوةةة",
    handle: "5012a5051sc1",
    rating: 4.5,
  },
  {
    name: "Aisha",
    location: "Muscat, Oman",
    quote: "I really loved the fabric and the fit!! Super chic.",
    handle: "5012a5058eg1",
    rating: 5,
  },
  {
    name: "Noor",
    location: "Kuwait City, Kuwait",
    quote: "In loveee with the leather details, soo luxurious",
    handle: "5012a4949sb1",
    rating: 5,
  },
];

export const GALLERY_IMAGES = [
  "/assets/home/gallery-1.jpg",
  "/assets/home/gallery-2.jpg",
  "/assets/home/gallery-3.jpg",
  "/assets/home/gallery-4.jpg",
];

// `icon` names a lucide component resolved in components/home/SimpleSections.tsx —
// inline SVG so the glyphs can take the gold brand colour on the dark band.
export const WHY_US = [
  { icon: "shield", key: "whyGuarantee", desc: "whyGuaranteeDesc", href: "/pages/terms-and-conditions" },
  { icon: "gem", key: "whyFabric", desc: "whyFabricDesc", href: "/pages/materials-colors" },
  { icon: "truck", key: "whyShipping", desc: "whyShippingDesc", href: "/pages/terms-and-conditions" },
] as const;
