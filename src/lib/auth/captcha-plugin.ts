import dynamic from "next/dynamic";
import { captchaPlugin as coreCaptchaPlugin } from "@better-auth-ui/react/plugins";

// Defer Turnstile script/package until an auth form actually mounts the captcha
const TurnstileCaptcha = dynamic(
  () => import("@/components/auth/turnstile-captcha").then((mod) => mod.TurnstileCaptcha),
  { ssr: false },
);

/**
 * Registers Cloudflare Turnstile for better-auth-ui forms
 * (sign-in, sign-up, forgot-password, magic-link).
 */
export const captchaPlugin = () =>
  coreCaptchaPlugin({
    render: TurnstileCaptcha,
  });
