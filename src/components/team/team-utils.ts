import { formatMinorCurrency } from "@/lib/currency";

export async function runWithLoading(
  setLoading: (loading: boolean) => void,
  work: () => Promise<void>,
) {
  setLoading(true);
  try {
    await work();
  } finally {
    setLoading(false);
  }
}

export function formatCurrency(amount: number | null, currency: string | null) {
  if (amount === null || !currency) return "—";
  return formatMinorCurrency(amount, currency, {
    currencyDisplay: "code",
    minimumFractionDigits: 0,
  });
}

export const numberFormatter = new Intl.NumberFormat(undefined);

export const monthDayFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

export const monthDayYearFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTokenLimit(value: number | null) {
  if (value === null) return "";
  return numberFormatter.format(value);
}

export function parseTokenLimit(value: string) {
  const normalized = value.replace(/[,_\s]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

export function escapeCsvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function createTeamSlug(name: string) {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
  const base = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return base ? `${base}-${suffix}` : `team-${suffix}`;
}
