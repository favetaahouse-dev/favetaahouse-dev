"use client";

import { useState } from "react";
import { X, Play } from "lucide-react";
import { useTranslations } from "next-intl";

export function CampaignVideo({ src = "/assets/video/campaign.mp4" }: { src?: string }) {
  const t = useTranslations("home");
  const [open, setOpen] = useState(false);

  return (
    <section className="relative h-screen w-full overflow-hidden">
      <video key={src} autoPlay muted loop playsInline src={src} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-black/25" />
      <button
        onClick={() => setOpen(true)}
        className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-white"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/70 transition-transform hover:scale-110">
          <Play size={26} fill="white" strokeWidth={0} className="ms-1" />
        </span>
        <span className="section-title !text-white" style={{ color: "#fff" }}>
          {t("discoverCampaign")}
        </span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute end-6 top-6 text-white"
            aria-label="Close"
          >
            <X size={28} />
          </button>
          <video
            controls
            autoPlay
            src={src}
            className="max-h-[85vh] w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
