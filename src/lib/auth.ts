import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import {
  anonymous,
  bearer,
  captcha,
  haveIBeenPwned,
  lastLoginMethod,
  magicLink,
  organization,
} from "better-auth/plugins";
import { twoFactor } from "better-auth/plugins/two-factor";
import { createElement } from "react";
import { db } from "@/db/drizzle";
import * as schema from "@/db/schema";
import { MagicLinkEmail, magicLinkEmailSubject } from "@/emails/magic-link-email";
import { OrgInvitationEmail } from "@/emails/org-invitation-email";
import { orgInvitationEmailSubject } from "@/emails/org-invitation-email-subject";
import { PasswordResetEmail, passwordResetEmailSubject } from "@/emails/password-reset-email";
import { VerificationEmail, verificationEmailSubject } from "@/emails/verification-email";
import { env } from "@/env";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  checkSignupEmail,
  signupEmailDenialCode,
  signupEmailDenialMessage,
} from "@/lib/email-domain-policy";
import { cancelPersonalSubscription, updateTeamSeatCount } from "@/lib/team-billing";

const emailEnabled = isEmailConfigured();

function assertAllowedSignupEmail(email: string) {
  const result = checkSignupEmail(email);
  if (result.ok) return;
  throw new APIError("BAD_REQUEST", {
    message: signupEmailDenialMessage(result.reason),
    code: signupEmailDenialCode(result.reason),
  });
}

export const auth = betterAuth({
  appName: "Deni AI",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  // Reject disallowed domains before verification / magic-link emails are sent.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (
        ctx.path !== "/sign-up/email" &&
        ctx.path !== "/sign-in/magic-link" &&
        ctx.path !== "/change-email"
      ) {
        return;
      }

      const body = ctx.body as { email?: unknown; newEmail?: unknown } | undefined;
      const email =
        typeof body?.email === "string"
          ? body.email
          : typeof body?.newEmail === "string"
            ? body.newEmail
            : null;
      if (!email) return;

      // Magic-link sign-in for an *existing* account keeps working even if
      // the domain is no longer on the allowlist (grandfathered users).
      if (ctx.path === "/sign-in/magic-link") {
        const existing = await ctx.context.internalAdapter.findUserByEmail(email);
        if (existing) return;
      }

      assertAllowedSignupEmail(email);
    }),
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: emailEnabled,
    sendResetPassword: emailEnabled
      ? async ({ user, url }) => {
          await sendEmail({
            to: user.email,
            subject: passwordResetEmailSubject,
            react: createElement(PasswordResetEmail, {
              name: user.name,
              resetUrl: url,
            }),
          });
        }
      : undefined,
  },
  emailVerification: emailEnabled
    ? {
        sendVerificationEmail: async ({ user, url }) => {
          await sendEmail({
            to: user.email,
            subject: verificationEmailSubject,
            react: createElement(VerificationEmail, {
              name: user.name,
              verificationUrl: url,
            }),
          });
        },
        // Send on sign-up and when an unverified user tries to sign in
        // (better-auth only auto-sends on sign-in when this flag is set).
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
      }
    : undefined,
  plugins: [
    anonymous(),
    twoFactor(),
    passkey(),
    haveIBeenPwned(),
    lastLoginMethod(),
    organization({
      allowUserToCreateOrganization: true,
      membershipLimit: 50,
      organizationHooks: {
        afterAcceptInvitation: async ({ organization, member }) => {
          await updateTeamSeatCount(organization.id);
          await cancelPersonalSubscription(member.userId);
        },
        afterRemoveMember: async ({ organization }) => {
          await updateTeamSeatCount(organization.id);
        },
      },
      sendInvitationEmail: emailEnabled
        ? async (data) => {
            const url = `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/settings/team?invitationId=${data.id}`;
            await sendEmail({
              to: data.email,
              subject: orgInvitationEmailSubject(data.organization.name),
              react: createElement(OrgInvitationEmail, {
                orgName: data.organization.name,
                inviterName: data.inviter.user.name,
                acceptUrl: url,
              }),
            });
          }
        : undefined,
    }),
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: env.TURNSTILE_SECRET_KEY,
      // Include defaults + magic-link request (not /magic-link/verify — email click).
      endpoints: [
        "/sign-up/email",
        "/sign-in/email",
        "/request-password-reset",
        "/sign-in/magic-link",
      ],
    }),
    bearer(),
    ...(emailEnabled
      ? [
          magicLink({
            sendMagicLink: async ({ email, url }) => {
              await sendEmail({
                to: email,
                subject: magicLinkEmailSubject,
                react: createElement(MagicLinkEmail, {
                  signInUrl: url,
                }),
              });
            },
          }),
        ]
      : []),
  ],
  socialProviders: {
    google: {
      enabled: true,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      enabled: true,
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
  rateLimit: {
    enabled: true,
    window: 60, // time window in seconds
    max: 100, // max requests in the window
    customRules: {
      "/sign-in/*": {
        window: 10,
        max: 3,
      },
      "/two-factor/*": async (_request) => {
        // custom function to return rate limit window and max
        return {
          window: 10,
          max: 3,
        };
      },
    },
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (every 1 day the session expiration is updated)
  },
  advanced: {
    database: {
      joins: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          // Guest / anonymous accounts are not gated by email domain.
          if (user.isAnonymous) return;
          if (!user.email) return;

          const path = typeof ctx?.path === "string" ? ctx.path : undefined;
          // OAuth (Google / GitHub) may use corporate domains — allow those.
          if (path?.startsWith("/callback/")) return;

          // Email/password, magic-link (new user), and other non-OAuth creates:
          // major providers + educational domains only (see email-domain-policy).
          assertAllowedSignupEmail(user.email);
        },
      },
      update: {
        before: async (data) => {
          // Block change-email flows that switch to a disallowed domain.
          const email = typeof data.email === "string" ? data.email : undefined;
          if (!email) return;
          assertAllowedSignupEmail(email);
        },
      },
    },
  },
});
