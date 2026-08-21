"use client";

import { useLocale } from "next-intl";
import { minorUnitToMajor } from "@/lib/currency";

const NUMBER_PART_TYPES = new Set([
  "minusSign",
  "plusSign",
  "integer",
  "group",
  "decimal",
  "fraction",
]);

const priceFormatters = new Map<string, Intl.NumberFormat>();

function getPriceFormatter(locale: string, currencyCode: string) {
  const key = `${locale}:${currencyCode}`;
  const cached = priceFormatters.get(key);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  });
  priceFormatters.set(key, formatter);
  return formatter;
}

export function useFormatPriceParts() {
  const locale = useLocale();

  return (amountMinor: number, currency?: string | null) => {
    const currencyCode = (currency ?? "USD").toUpperCase();
    const formatter = getPriceFormatter(locale, currencyCode);
    const parts = formatter.formatToParts(minorUnitToMajor(amountMinor, currencyCode));

    let currencyLabel = "";
    let amount = "";
    for (const part of parts) {
      if (part.type === "currency") {
        currencyLabel += part.value;
      } else if (NUMBER_PART_TYPES.has(part.type)) {
        amount += part.value;
      }
    }

    return {
      currency: currencyLabel,
      amount,
    };
  };
}
