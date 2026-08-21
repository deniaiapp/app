"use client";

import { Download, QrCode } from "lucide-react";
import { useExtracted } from "next-intl";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

async function toReferralQrDataUrl(url: string) {
  return QRCode.toDataURL(url, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#111827", light: "#ffffff" },
  });
}

export function ReferralQrCode({ url }: { url: string }) {
  const t = useExtracted();
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void toReferralQrDataUrl(url)
      .then((value) => {
        if (active) {
          setDataUrl(value);
        }
      })
      .catch(() => {
        if (active) {
          setDataUrl(null);
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10">
      <div className="flex size-52 items-center justify-center rounded-xl bg-white p-2">
        {dataUrl ? (
          <img src={dataUrl} alt={t("QR code for your referral link")} className="size-full" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <QrCode className="size-10 animate-pulse" />
            <span className="text-xs">{t("Generating QR code…")}</span>
          </div>
        )}
      </div>
      {dataUrl ? (
        <Button asChild size="sm" className="w-full">
          <a href={dataUrl} download="deni-ai-referral-qr.png">
            <Download className="size-3.5" />
            {t("Download QR")}
          </a>
        </Button>
      ) : null}
    </div>
  );
}
