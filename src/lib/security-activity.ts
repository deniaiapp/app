import { db } from "@/db/drizzle";
import { securityActivity, user } from "@/db/schema";
import { eq } from "drizzle-orm";

const SECURITY_ACTIVITY_ACTIONS = [
  "signed_in",
  "signed_out",
  "password_changed",
  "email_changed",
  "two_factor_enabled",
  "two_factor_disabled",
  "passkey_added",
  "passkey_removed",
  "session_revoked",
  "account_linked",
  "account_unlinked",
  "data_exported",
] as const;

export type SecurityActivityAction = (typeof SECURITY_ACTIVITY_ACTIONS)[number];

const PATH_ACTIONS: Array<{ prefix: string; action: SecurityActivityAction }> = [
  { prefix: "/sign-out", action: "signed_out" },
  { prefix: "/change-password", action: "password_changed" },
  { prefix: "/change-email", action: "email_changed" },
  { prefix: "/two-factor/enable", action: "two_factor_enabled" },
  { prefix: "/two-factor/disable", action: "two_factor_disabled" },
  { prefix: "/passkey/verify-registration", action: "passkey_added" },
  { prefix: "/passkey/delete-passkey", action: "passkey_removed" },
  { prefix: "/revoke-session", action: "session_revoked" },
  { prefix: "/revoke-other-sessions", action: "session_revoked" },
  { prefix: "/revoke-sessions", action: "session_revoked" },
  { prefix: "/link-social", action: "account_linked" },
  { prefix: "/unlink-account", action: "account_unlinked" },
];

export async function recordSecurityActivity({
  userId,
  action,
  ipAddress,
  userAgent,
  metadata,
}: {
  userId: string;
  action: SecurityActivityAction;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(securityActivity).values({
    userId,
    action,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
    metadata: metadata ?? {},
  });
}

export function securityActionForAuthPath(path: string): SecurityActivityAction | null {
  const match = PATH_ACTIONS.find(
    (entry) => path === entry.prefix || path.startsWith(`${entry.prefix}/`),
  );
  return match?.action ?? null;
}

export async function isAnonymousUser(userId: string) {
  const [row] = await db
    .select({ isAnonymous: user.isAnonymous })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return Boolean(row?.isAnonymous);
}
