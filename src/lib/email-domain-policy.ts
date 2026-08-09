/**
 * Email domain policy for credential / magic-link sign-up.
 *
 * Allowlist model:
 *  1. Known major consumer mail providers (exact domain match)
 *  2. Educational domains (.edu, .ac.*, .edu.*, .ed.jp, …) with
 *     spam-prone country codes excluded
 *
 * OAuth (Google / GitHub) is not gated by this module — those identities
 * are already provider-verified. Apply only on email-based registration
 * paths (see auth.ts).
 */

/** Exact domains allowed for email/password and magic-link sign-up. */
export const ALLOWED_EMAIL_PROVIDERS: ReadonlySet<string> = new Set([
  // Google
  "gmail.com",
  "googlemail.com",
  // Microsoft
  "outlook.com",
  "outlook.jp",
  "hotmail.com",
  "hotmail.co.jp",
  "live.com",
  "live.jp",
  "msn.com",
  // Apple
  "icloud.com",
  "me.com",
  "mac.com",
  // Yahoo
  "yahoo.com",
  "yahoo.co.jp",
  "ymail.com",
  "rocketmail.com",
  // Proton
  "proton.me",
  "protonmail.com",
  "pm.me",
  // Privacy-focused / other major
  "aol.com",
  "zoho.com",
  "zohomail.com",
  "fastmail.com",
  "fastmail.fm",
  "hey.com",
  "duck.com",
  "tutanota.com",
  "tuta.com",
  "tutamail.com",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "mail.com",
  "icloud.com.jp",
  // Yandex / Mail.ru ecosystem
  "yandex.com",
  "yandex.ru",
  "ya.ru",
  "mail.ru",
  "bk.ru",
  "inbox.ru",
  "list.ru",
  // East Asia majors
  "qq.com",
  "163.com",
  "126.com",
  "sina.com",
  "naver.com",
  "daum.net",
  "hanmail.net",
  "kakao.com",
  // Japan mobile carriers (common primary addresses)
  "docomo.ne.jp",
  "ezweb.ne.jp",
  "softbank.ne.jp",
  "i.softbank.jp",
  "au.com",
  "uqmobile.jp",
  "ymobile.ne.jp",
  "rakuten.jp",
  // Other common
  "web.de",
  "t-online.de",
  "orange.fr",
  "free.fr",
  "laposte.net",
  "libero.it",
  "virgilio.it",
  "wp.pl",
  "o2.pl",
  "seznam.cz",
  "btinternet.com",
  "sky.com",
  "virginmedia.com",
  "comcast.net",
  "verizon.net",
  "att.net",
  "sbcglobal.net",
  "cox.net",
  "charter.net",
  "earthlink.net",
]);

/**
 * Country codes where `.edu.<cc>` / `.ac.<cc>` are frequently abused for
 * disposable / mass sign-ups. Pure US `.edu` (no country suffix) is always
 * allowed and is not affected by this list.
 *
 * Keep this list focused on observed abuse rather than blocking every
 * developing-country academic domain.
 */
export const BLOCKED_EDU_COUNTRY_CODES: ReadonlySet<string> = new Set([
  // Latin America (high volume of fake school domains in abuse feeds)
  "co", // Colombia — e.g. *.edu.co spam
  "br",
  "mx",
  "pe",
  "ar",
  "cl",
  "ec",
  "bo",
  "py",
  "uy",
  "ve",
  "do",
  "gt",
  "hn",
  "sv",
  "ni",
  "cr",
  "pa",
  // South / Southeast Asia
  "vn",
  "ph",
  "pk",
  "in",
  "bd",
  "id",
  "lk",
  "np",
  "mm",
  "kh",
  "la",
  "my",
  "th",
  // Africa / Middle East (common throwaway edu patterns)
  "ng",
  "eg",
  "ke",
  "gh",
  "et",
  "tz",
  "ug",
  "za",
  "dz",
  "ma",
  "tn",
  "iq",
  "ir",
  "sy",
  "af",
  "sd",
  "ye",
  // Other high-abuse
  "cn",
  "ru",
  "ua",
  "tr",
  "by",
  "kz",
]);

/** Educational second-level labels we recognize (before country / as TLD). */
const EDU_LABELS = new Set(["edu", "ac", "ed", "sch"]);

export function extractEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  // strip trailing dots / ignore display-name forms
  const domain = trimmed.slice(at + 1).replace(/\.+$/, "");
  if (!domain || domain.includes(" ") || domain.includes("@")) return null;
  return domain;
}

/**
 * Educational domain check.
 * - `school.edu`, `sub.school.edu` → allowed (US-style .edu TLD)
 * - `school.ac.jp`, `school.edu.au` → allowed unless country is blocked
 * - `school.ed.jp` → allowed (Japan K-12 style)
 * - `school.edu.co`, `school.edu.vn` → blocked via BLOCKED_EDU_COUNTRY_CODES
 */
export function isAllowedEducationalDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  const labels = d.split(".").filter(Boolean);
  if (labels.length < 2) return false;

  const tld = labels[labels.length - 1]!;

  // Pure academic TLD: example.edu
  if (tld === "edu" || tld === "ac") {
    return true;
  }

  // Two-part academic: example.ac.jp / example.edu.au / example.ed.jp / example.sch.uk
  if (labels.length >= 3) {
    const sld = labels[labels.length - 2]!;
    const country = tld;
    if (country.length === 2 && EDU_LABELS.has(sld)) {
      return !BLOCKED_EDU_COUNTRY_CODES.has(country);
    }
  }

  return false;
}

export function isAllowedEmailProviderDomain(domain: string): boolean {
  return ALLOWED_EMAIL_PROVIDERS.has(domain.toLowerCase());
}

/** True when the email may be used for email/password or magic-link sign-up. */
export function isAllowedSignupEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  if (isAllowedEmailProviderDomain(domain)) return true;
  if (isAllowedEducationalDomain(domain)) return true;
  return false;
}

export type SignupEmailPolicyResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "not_allowed" };

export function checkSignupEmail(email: string): SignupEmailPolicyResult {
  const domain = extractEmailDomain(email);
  if (!domain) return { ok: false, reason: "invalid" };
  if (isAllowedSignupEmail(email)) return { ok: true };
  return { ok: false, reason: "not_allowed" };
}

/**
 * Paths where email domain whitelist should be enforced.
 * OAuth callbacks are intentionally excluded so Google Workspace / GitHub
 * corporate emails still work.
 */
export function isEmailRegistrationPath(path: string | undefined | null): boolean {
  if (!path) return false;
  return (
    path === "/sign-up/email" ||
    path.startsWith("/sign-up/email") ||
    path === "/sign-in/magic-link" ||
    path.startsWith("/sign-in/magic-link") ||
    path === "/magic-link/verify" ||
    path.startsWith("/magic-link/verify") ||
    path === "/change-email" ||
    path.startsWith("/change-email")
  );
}
