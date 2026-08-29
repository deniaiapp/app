/**
 * Auth route path segments shared by Server and Client Components.
 * Keep this module free of "use client" and runtime side effects so route
 * whitelists on the server compare plain strings (not client references).
 */

/** Path segment for the second-factor challenge (not in better-auth-ui viewPaths). */
export const TWO_FACTOR_VIEW_PATH = "two-factor";

/** Full path for second-factor verification after credential sign-in. */
export const TWO_FACTOR_PATH = `/auth/${TWO_FACTOR_VIEW_PATH}`;

/** Account security settings (change password, sessions, 2FA, passkeys). */
export const ACCOUNT_SECURITY_PATH = "/account/security";
