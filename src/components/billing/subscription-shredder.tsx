"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useExtracted, useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatMinorCurrency } from "@/lib/currency";
import { formatReceiptOrderId } from "@/lib/stripe-checkout-receipt";
import { cn } from "@/lib/utils";
import {
  ReceiptPaper,
  ReceiptPrinterCard,
  type SubscriptionReceiptData,
} from "./subscription-receipt";

const STRIP_COUNT = 14;
const SHRED_MS = 2200;
const DONE_HOLD_MS = 1100;

type ShredPhase = "hold" | "shredding" | "done";

function ShreddedReceipt({
  data,
  orderId,
  paidAtLabel,
  money,
  shredding,
  reducedMotion,
}: {
  data: SubscriptionReceiptData;
  orderId: string;
  paidAtLabel: string;
  money: (amount: number) => string;
  shredding: boolean;
  reducedMotion: boolean;
}) {
  return (
    <div className="relative">
      {Array.from({ length: STRIP_COUNT }, (_, index) => {
        const left = (index / STRIP_COUNT) * 100;
        const width = 100 / STRIP_COUNT;
        const tilt = ((index % 5) - 2) * 3.4;
        const drift = ((index % 3) - 1) * 10;
        const delay = reducedMotion ? 0 : index * 48;

        return (
          <div
            className="absolute inset-0 origin-top will-change-transform"
            key={index}
            style={{
              clipPath: `inset(0 ${Math.max(0, 100 - left - width)}% 0 ${left}%)`,
              transform: shredding
                ? `translate3d(${drift}px, 130%, 0) rotate(${tilt}deg)`
                : "translate3d(0, 0, 0)",
              opacity: shredding ? 0 : 1,
              transition: reducedMotion
                ? "opacity 180ms linear"
                : `transform ${SHRED_MS}ms cubic-bezier(0.55, 0.06, 0.68, 0.19) ${delay}ms, opacity 420ms linear ${delay + 1500}ms`,
            }}
          >
            <ReceiptPaper data={data} money={money} orderId={orderId} paidAtLabel={paidAtLabel} />
          </div>
        );
      })}
      <div className="invisible">
        <ReceiptPaper data={data} money={money} orderId={orderId} paidAtLabel={paidAtLabel} />
      </div>
    </div>
  );
}

function ShredStatus({ phase }: { phase: ShredPhase }) {
  const t = useExtracted();

  if (phase === "done") {
    return (
      <div className="flex items-center gap-2 text-[13px] text-emerald-400">
        <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
        {t("Subscription canceled")}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[13px] text-white/55">
      <LoaderCircle className="size-3.5 animate-spin" />
      {phase === "shredding" ? t("Shredding your receipt") : t("Canceling your subscription")}
    </div>
  );
}

export function SubscriptionShredder({
  open,
  data,
  onConfirm,
  onClose,
}: {
  open: boolean;
  data: SubscriptionReceiptData;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const shouldReduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<ShredPhase>("hold");
  const orderId = formatReceiptOrderId(data.sessionId);
  const paidAtLabel = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(data.paidAt ? new Date(data.paidAt) : new Date())
    .replace(",", " ·");
  const money = (amount: number) => formatMinorCurrency(amount, data.currency, undefined, locale);
  const confirmRef = useRef(onConfirm);
  const closeRef = useRef(onClose);
  confirmRef.current = onConfirm;
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) {
      setPhase("hold");
      return;
    }

    let cancelled = false;
    let shredTimer = 0;
    let closeTimer = 0;

    async function run() {
      setPhase("hold");
      try {
        await confirmRef.current();
        if (cancelled) {
          return;
        }
        setPhase("shredding");
        shredTimer = window.setTimeout(
          () => {
            if (!cancelled) {
              setPhase("done");
              toast.success(t("Subscription will end at period end."));
            }
          },
          shouldReduceMotion ? 200 : SHRED_MS + 200,
        );
        closeTimer = window.setTimeout(
          () => {
            if (!cancelled) {
              closeRef.current();
            }
          },
          shouldReduceMotion ? 700 : SHRED_MS + DONE_HOLD_MS + 200,
        );
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : t("Failed to cancel subscription"));
          closeRef.current();
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
      window.clearTimeout(shredTimer);
      window.clearTimeout(closeTimer);
    };
  }, [open, shouldReduceMotion, t]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[min(24rem,100%)]">
        <ReceiptPrinterCard
          homeHref={data.homeHref}
          homeLabel={data.homeLabel}
          outlet={
            <div
              className={cn(
                "relative z-50 mx-5 -mt-2 overflow-hidden",
                phase === "shredding" || phase === "done" ? "overflow-visible" : "overflow-hidden",
              )}
            >
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 z-20 h-3 bg-[repeating-linear-gradient(90deg,#111_0_4px,transparent_4px_7px)]",
                  phase === "shredding" && "animate-pulse",
                )}
              />
              <ShreddedReceipt
                data={data}
                money={money}
                orderId={orderId}
                paidAtLabel={paidAtLabel}
                reducedMotion={Boolean(shouldReduceMotion)}
                shredding={phase === "shredding" || phase === "done"}
              />
            </div>
          }
          planDescription={data.planDescription}
          planTitle={data.planTitle}
          totalAmount={money(data.amountTotal)}
        >
          <ShredStatus phase={phase} />
        </ReceiptPrinterCard>
      </div>
    </div>
  );
}
