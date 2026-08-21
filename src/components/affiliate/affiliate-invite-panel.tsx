"use client";

import { Clipboard, RotateCcw, Users } from "lucide-react";
import { useExtracted } from "next-intl";
import { ReferralQrCode } from "@/components/affiliate/affiliate-qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type AffiliateInviteStatus = {
  code: string;
  referralUrl: string;
  resetCredits: number;
};

export function AffiliateInvitePanel({
  status,
  isResetPending,
  onCopy,
  onReset,
}: {
  status: AffiliateInviteStatus;
  isResetPending: boolean;
  onCopy: (value: string, message: string) => Promise<void>;
  onReset: () => void;
}) {
  const t = useExtracted();

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="overflow-hidden border-foreground/10">
        <CardHeader className="border-b bg-muted/35">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <CardTitle>{t("Your invite link")}</CardTitle>
          </div>
          <CardDescription>
            {t(
              "Share your link or QR code. The referral counts when the person registers through it.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("Referral code")}
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-xl border bg-muted/40 px-4 py-2 font-mono text-lg font-semibold tracking-[0.18em]">
                  {status.code}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("Copy referral code")}
                  title={t("Copy referral code")}
                  onClick={() => void onCopy(status.code, t("Referral code copied."))}
                >
                  <Clipboard className="size-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("Shareable link")}
              </div>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={status.referralUrl}
                  aria-label={t("Shareable referral link")}
                  className="min-w-0 bg-muted/30 font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("Copy referral link")}
                  title={t("Copy referral link")}
                  onClick={() => void onCopy(status.referralUrl, t("Referral link copied."))}
                >
                  <Clipboard className="size-4" />
                </Button>
              </div>
            </div>
          </div>
          <ReferralQrCode url={status.referralUrl} />
        </CardContent>
      </Card>

      <Card className="border-chart-4/40 bg-chart-4/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <RotateCcw className="size-4" />
            <CardTitle>{t("Use a reset credit")}</CardTitle>
          </div>
          <CardDescription>
            {t(
              "Use one reset credit to clear your current basic and premium usage counters immediately.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-4xl font-semibold tabular-nums">{status.resetCredits}</div>
              <div className="text-sm text-muted-foreground">{t("credits available")}</div>
            </div>
            <Button disabled={status.resetCredits < 1 || isResetPending} onClick={onReset}>
              {isResetPending ? <Spinner /> : <RotateCcw className="size-4" />}
              {t("Reset limits now")}
            </Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {t(
              "Three-registration rewards require our approval. Paid-plan reset rewards are added automatically, while coupon rewards are sent via email after we process them.",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
