import { env } from "@/env";

function parseAdminEmails(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function getBlogAdminEmails() {
  const dedicated = parseAdminEmails(env.BLOG_ADMIN_EMAILS);
  if (dedicated.size > 0) {
    return dedicated;
  }

  return parseAdminEmails(env.AFFILIATE_ADMIN_EMAILS);
}

export function isBlogAdmin(email: string | null | undefined) {
  return Boolean(email && getBlogAdminEmails().has(email.trim().toLowerCase()));
}
