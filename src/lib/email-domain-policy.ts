/**
 * Email domain policy for credential / magic-link sign-up.
 *
 * Allowlist model:
 *  1. Known major consumer mail providers (exact domain match)
 *  2. Educational domains only under TLDs / SLDs with **restricted
 *     registration** (real schools / universities), not open `.edu.<cc>`
 *     namespaces that are routinely sold as throwaway mail
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
 * Educational domain suffixes with restricted registration (institutions only).
 *
 * Match when `domain === suffix` or `domain.endsWith("." + suffix)`.
 * Open / high-abuse namespaces (e.g. `.edu.kg`, bare `.ac` Ascension TLD,
 * most `.edu.<cc>` without real eligibility checks) are intentionally omitted.
 *
 * Add a suffix here only when the registry limits names to real schools.
 */
export const ALLOWED_EDU_DOMAIN_SUFFIXES: readonly string[] = [
  // United States — sponsored gTLD, eligibility-restricted
  "edu",
  // Japan — JPRS academic / school namespaces
  "ac.jp",
  "ed.jp",
  // United Kingdom — JANET academic / school
  "ac.uk",
  "sch.uk",
  // Australia — auDA education eligibility
  "edu.au",
  // New Zealand — academic
  "ac.nz",
  // South Korea — academic
  "ac.kr",
  // Taiwan — education
  "edu.tw",
  // Singapore — education
  "edu.sg",
  // Hong Kong — education
  "edu.hk",
];

export function extractEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  // strip trailing dots / ignore display-name forms
  const domain = trimmed.slice(at + 1).replace(/\.+$/, "");
  if (!domain || domain.includes(" ") || domain.includes("@")) return null;
  return domain;
}

function domainMatchesSuffix(domain: string, suffix: string): boolean {
  return domain === suffix || domain.endsWith(`.${suffix}`);
}

/**
 * Educational domain check (restricted-registration allowlist only).
 * - `mit.edu`, `cs.stanford.edu` → allowed (US `.edu`)
 * - `u-tokyo.ac.jp`, `school.ed.jp` → allowed
 * - `ox.ac.uk`, `uni.edu.au` → allowed
 * - `cmuk.edu.kg`, `foo.edu.co`, bare `something.ac` → denied
 */
export function isAllowedEducationalDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  const labels = d.split(".").filter(Boolean);
  // Need at least school.edu or school.ac.jp
  if (labels.length < 2) return false;

  return ALLOWED_EDU_DOMAIN_SUFFIXES.some((suffix) => domainMatchesSuffix(d, suffix));
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
