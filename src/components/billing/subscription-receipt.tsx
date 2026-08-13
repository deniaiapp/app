"use client";

import { Check, Home, LoaderCircle, RotateCcw } from "lucide-react";
import { useReducedMotion } from "motion/react";
import Link from "next/link";
import { useExtracted, useLocale } from "next-intl";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent,
} from "react";
import DeniAIIcon from "@/components/deni-ai-icon";
import { formatMinorCurrency } from "@/lib/currency";
import { formatPaymentMethodLabel, formatReceiptOrderId } from "@/lib/stripe-checkout-receipt";
import { cn } from "@/lib/utils";

export type SubscriptionReceiptData = {
  sessionId: string;
  planTitle: string;
  planDescription: string;
  planLineLabel: string;
  amountTotal: number;
  amountSubtotal: number | null;
  amountTax: number | null;
  amountDiscount: number | null;
  currency: string;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
  paidAt: string | Date | null;
  homeHref: string;
  homeLabel: string;
};

type ReceiptPhase = "processing" | "printing" | "complete";

const PRINT_START_MS = 480;
const PRINT_MS = 2000;

const PAPER = "#f4f1ea";
const PAPER_INK = "#1a1a1a";

const receiptDateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getReceiptDateFormatter(locale: string) {
  const cached = receiptDateFormatterCache.get(locale);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  receiptDateFormatterCache.set(locale, formatter);
  return formatter;
}

function formatReceiptDate(value: string | Date | null, locale: string) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = getReceiptDateFormatter(locale).formatToParts(safeDate);
  const dateText = parts
    .filter((part) => part.type !== "hour" && part.type !== "minute" && part.type !== "literal")
    .filter((part) => part.type !== "dayPeriod")
    .map((part) => part.value)
    .join(" ")
    .replaceAll(",", "")
    .replace(/\s+/g, " ")
    .trim();
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${dateText} · ${hour}:${minute}`;
}

function buildBarcodePattern(value: string) {
  const bars: number[] = [1.6, 0.7, 1.6, 0.7];
  for (const char of value) {
    const code = char.charCodeAt(0);
    bars.push(
      0.8 + ((code >> 0) & 1) * 0.9,
      0.7,
      0.8 + ((code >> 1) & 1) * 1.1,
      0.6,
      0.8 + ((code >> 2) & 1) * 0.8,
      0.7,
      1.1 + ((code >> 3) & 1) * 0.7,
      0.6,
    );
  }
  bars.push(1.6, 0.7, 1.6);
  return bars;
}

function ReceiptBarcode({ value }: { value: string }) {
  const bars = buildBarcodePattern(value);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div aria-hidden="true" className="flex h-10 items-stretch justify-center">
        {bars.map((width, index) => (
          <span
            className={index % 2 === 0 ? "bg-[#1a1a1a]" : "bg-transparent"}
            key={`${value}-${index}`}
            style={{ width: `${width * 1.35}px` }}
          />
        ))}
      </div>
      <div className="font-mono text-[9px] tracking-[0.28em] text-[#8a857c] uppercase">{value}</div>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-6 text-[11px] leading-5",
        muted ? "text-[#8a857c]" : "text-[#1a1a1a]",
      )}
    >
      <span>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

export function ReceiptPaper({
  data,
  orderId,
  paidAtLabel,
  money,
}: {
  data: SubscriptionReceiptData;
  orderId: string;
  paidAtLabel: string;
  money: (amount: number) => string;
}) {
  const t = useExtracted();
  const paymentMethod = formatPaymentMethodLabel(data.paymentMethodBrand, data.paymentMethodLast4);
  const lineAmount = data.amountSubtotal ?? data.amountTotal;
  const showSubtotal = data.amountSubtotal !== null;
  const showTax = (data.amountTax ?? 0) > 0;
  const showDiscount = (data.amountDiscount ?? 0) > 0;

  return (
    <div
      className="relative z-1000 origin-top pt-8 shadow-[0_16px_28px_-10px_rgba(0,0,0,0.38)]"
      style={{
        backgroundColor: PAPER,
        color: PAPER_INK,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-14 bg-gradient-to-b from-black/40 via-black/14 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-multiply"
        style={{
          backgroundImage: "radial-gradient(rgba(40,32,20,0.045) 0.6px, transparent 0.6px)",
          backgroundSize: "3px 3px",
        }}
      />

      <div className="relative px-5 pb-4 sm:px-7">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-md bg-[#161616] text-white">
            <DeniAIIcon className="size-7" />
          </div>
        </div>

        <div className="mt-10 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-[0.08em] uppercase">
              {data.planLineLabel}
            </div>
            <div className="mt-0.5 text-[11px] text-[#8a857c]">{data.planDescription}</div>
          </div>
          <div className="shrink-0 text-[11px] tabular-nums">{money(lineAmount)}</div>
        </div>

        <div className="mt-6 border-t border-[#1a1a1a]/15 pt-4">
          {showSubtotal ? (
            <ReceiptRow
              label={t("Subtotal")}
              muted
              value={money(data.amountSubtotal ?? lineAmount)}
            />
          ) : null}
          {showDiscount ? (
            <ReceiptRow label={t("Discount")} muted value={`−${money(data.amountDiscount ?? 0)}`} />
          ) : null}
          {showTax ? (
            <ReceiptRow label={t("Tax")} muted value={money(data.amountTax ?? 0)} />
          ) : null}
          <div className="mt-3 flex items-start justify-between gap-4 text-[13px] font-semibold tracking-[0.06em] uppercase">
            <span>{t("Total paid")}</span>
            <span className="tabular-nums">{money(data.amountTotal)}</span>
          </div>
        </div>

        <div className="mt-8 space-y-1">
          <ReceiptRow label={t("Order")} muted value={orderId} />
          {paymentMethod ? <ReceiptRow label={t("Paid with")} muted value={paymentMethod} /> : null}
          <ReceiptRow label={t("Date")} muted value={paidAtLabel} />
        </div>

        <div className="mt-8">
          <ReceiptBarcode value={orderId} />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="h-3 w-full"
        style={{
          backgroundImage: `linear-gradient(135deg, ${PAPER} 50%, transparent 50%), linear-gradient(-135deg, ${PAPER} 50%, transparent 50%)`,
          backgroundPosition: "0 0, 8px 0",
          backgroundRepeat: "repeat-x",
          backgroundSize: "16px 12px",
        }}
      />
    </div>
  );
}

export const receiptDeviceCardClassName =
  "rounded-[1.7rem] border border-white/8 bg-[#171717] text-white shadow-[0_18px_50px_-24px_rgba(0,0,0,0.65)]";

export function ReceiptPrinterCard({
  homeHref,
  homeLabel,
  planTitle,
  planDescription,
  totalAmount,
  children,
  outlet,
}: {
  homeHref: string;
  homeLabel: string;
  planTitle: string;
  planDescription: string;
  totalAmount: string;
  children: ReactNode;
  outlet?: ReactNode;
}) {
  const t = useExtracted();

  return (
    <div className="relative">
      <div
        className={cn("relative z-10 p-3.5", receiptDeviceCardClassName, outlet ? "pb-2" : "pb-3")}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 text-white">
            <DeniAIIcon className="size-6" />
          </div>
          <Link
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/8 px-2.5 text-[13px] text-white/90 transition-colors hover:bg-white/12 sm:px-3"
            href={homeHref}
          >
            <Home className="size-3.5" />
            <span className="hidden min-[400px]:inline">{homeLabel}</span>
          </Link>
        </div>

        <div className="mt-6 flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-medium tracking-tight">{planTitle}</div>
            <div className="mt-0.5 truncate text-[13px] text-white/50">{planDescription}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[11px] text-white/45">{t("Total")}</div>
            <div className="mt-0.5 text-[15px] font-medium tabular-nums">{totalAmount}</div>
          </div>
        </div>

        <div className="mt-5 px-1">{children}</div>

        <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-black shadow-[inset_0_2px_3px_rgba(0,0,0,0.85)]">
          <div className="absolute inset-x-4 top-0 h-px bg-white/10" />
        </div>
      </div>
      {outlet}
    </div>
  );
}

function ReceiptStatus({ phase }: { phase: ReceiptPhase }) {
  const t = useExtracted();

  if (phase === "complete") {
    return (
      <div className="flex items-center gap-2 text-[13px] text-emerald-400">
        <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
        {t("Order complete")}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[13px] text-white/55">
      <LoaderCircle className="size-3.5 animate-spin" />
      {phase === "printing" ? t("Printing your receipt") : t("Processing your order")}
    </div>
  );
}

function SubscriptionReceiptStage({
  data,
  money,
  orderId,
  paidAtLabel,
  onPlayingChange,
}: {
  data: SubscriptionReceiptData;
  money: (amount: number) => string;
  orderId: string;
  paidAtLabel: string;
  onPlayingChange: (playing: boolean) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const paperRef = useRef<HTMLDivElement>(null);
  const [paperHeight, setPaperHeight] = useState(0);
  const [phase, setPhase] = useState<ReceiptPhase>(shouldReduceMotion ? "complete" : "processing");
  const isPrinting = phase !== "processing";

  useLayoutEffect(() => {
    const node = paperRef.current;
    if (!node) {
      return;
    }

    const update = () => {
      setPaperHeight(node.getBoundingClientRect().height);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (shouldReduceMotion) {
      setPhase("complete");
      return;
    }

    setPhase("processing");
    const printTimer = window.setTimeout(() => setPhase("printing"), PRINT_START_MS);
    const fallbackTimer = window.setTimeout(
      () => setPhase((current) => (current === "printing" ? "complete" : current)),
      PRINT_START_MS + PRINT_MS + 80,
    );
    return () => {
      window.clearTimeout(printTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, [shouldReduceMotion]);

  useEffect(() => {
    onPlayingChange(phase !== "complete");
  }, [onPlayingChange, phase]);

  function handlePrintTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "max-height") {
      return;
    }
    if (phase === "printing") {
      setPhase("complete");
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-[min(24rem,100%)]">
      <ReceiptPrinterCard
        homeHref={data.homeHref}
        homeLabel={data.homeLabel}
        outlet={
          <div
            className="relative z-50 mx-5 -mt-2 overflow-hidden"
            onTransitionEnd={handlePrintTransitionEnd}
            style={{
              maxHeight: isPrinting || shouldReduceMotion ? paperHeight : 0,
              transition: shouldReduceMotion
                ? "max-height 0ms linear"
                : `max-height ${PRINT_MS}ms cubic-bezier(0.22, 0.12, 0.18, 1)`,
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-7 bg-gradient-to-b from-[#171717] to-transparent"
            />
            <div ref={paperRef}>
              <ReceiptPaper data={data} money={money} orderId={orderId} paidAtLabel={paidAtLabel} />
            </div>
          </div>
        }
        planDescription={data.planDescription}
        planTitle={data.planTitle}
        totalAmount={money(data.amountTotal)}
      >
        <ReceiptStatus phase={phase} />
      </ReceiptPrinterCard>
    </div>
  );
}

export function SubscriptionReceipt({ data }: { data: SubscriptionReceiptData }) {
  const t = useExtracted();
  const locale = useLocale();
  const replayLabelId = useId();
  const [playId, setPlayId] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const orderId = formatReceiptOrderId(data.sessionId);
  const paidAtLabel = formatReceiptDate(data.paidAt, locale);
  const money = (amount: number) => formatMinorCurrency(amount, data.currency, undefined, locale);

  return (
    <div className="relative mx-auto w-full max-w-xl overflow-x-clip px-3 py-6 sm:py-10">
      <div className="mb-4 flex justify-end">
        <button
          aria-labelledby={replayLabelId}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-xs backdrop-blur-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
          disabled={isAnimating}
          onClick={() => {
            setIsAnimating(true);
            setPlayId((current) => current + 1);
          }}
          type="button"
        >
          <RotateCcw className="size-3.5" />
          <span id={replayLabelId}>{t("Replay")}</span>
        </button>
      </div>

      <SubscriptionReceiptStage
        data={data}
        key={playId}
        money={money}
        onPlayingChange={setIsAnimating}
        orderId={orderId}
        paidAtLabel={paidAtLabel}
      />
    </div>
  );
}
