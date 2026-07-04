"use client";

import { useState } from "react";
import { getCatalogEntry } from "@/lib/paymentCatalog";

const PR = "https://raw.githubusercontent.com/payrexx/payment-logos/main/assets/card-icons/";

interface Props {
  /** The `icon` field returned by the API — this is the catalog ID e.g. "paypal", "bitcoin" */
  iconId: string;
  /** Fallback display name if catalog entry not found */
  name?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

const SIZES = {
  xs: "w-8 h-8 text-xs",
  sm: "w-10 h-10 text-sm",
  md: "w-12 h-12 text-base",
  lg: "w-16 h-16 text-xl",
};

export default function PaymentMethodLogo({ iconId, name, size = "md" }: Props) {
  const entry = getCatalogEntry(iconId);
  const displayName = name || entry.name;

  const [svgFailed, setSvgFailed] = useState(false);
  const [clearFailed, setClearFailed] = useState(false);

  const src = !svgFailed && entry.svgFile
    ? `${PR}${entry.svgFile}`
    : !clearFailed && entry.domain
    ? `https://logo.clearbit.com/${entry.domain}`
    : null;

  const dim = SIZES[size];

  if (!src) {
    return (
      <div
        className={`${dim} rounded-xl flex items-center justify-center font-black shrink-0`}
        style={{ background: `${entry.color}22`, border: `1.5px solid ${entry.color}55`, color: entry.color }}
      >
        {displayName[0]?.toUpperCase() ?? "?"}
      </div>
    );
  }

  return (
    <div className={`${dim} rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0 border border-white/10`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={displayName}
        className="w-[82%] h-[82%] object-contain"
        onError={() => {
          if (!svgFailed && entry.svgFile) { setSvgFailed(true); }
          else { setClearFailed(true); }
        }}
      />
    </div>
  );
}
