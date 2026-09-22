"use client";

import Script from "next/script";
import { clientEnv } from "@/env.client";

export function AdSenseScript() {
  if (!clientEnv.NEXT_PUBLIC_ADSENSE_CLIENT_ID || process.env.NODE_ENV !== "production") {
    return null;
  }

  return (
    <Script
      id="adsense-script"
      strategy="lazyOnload"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientEnv.NEXT_PUBLIC_ADSENSE_CLIENT_ID}`}
    />
  );
}
