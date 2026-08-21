"use client";

import type { VariantProps } from "class-variance-authority";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button, type buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { User } from "lucide-react";

type GuestSignInButtonProps = VariantProps<typeof buttonVariants> & {
  className?: string;
};

async function runWithLoading(setLoading: (value: boolean) => void, work: () => Promise<void>) {
  setLoading(true);
  try {
    await work();
  } finally {
    setLoading(false);
  }
}

export function GuestSignInButton({
  className,
  size = "lg",
  variant = "outline",
}: GuestSignInButtonProps) {
  const t = useExtracted();
  const { data: session, isPending } = authClient.useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (session) {
    return null;
  }

  const handleClick = () => {
    if (isPending || isSubmitting) return;
    void runWithLoading(setIsSubmitting, async () => {
      try {
        const { data, error } = await authClient.signIn.anonymous();
        if (error || !data) {
          toast.error(error?.message || t("Failed to sign in as guest. Please try again."));
          return;
        }

        // A /chat prefetch made before sign-in can contain the unauthenticated
        // redirect. Use a document navigation so that cached RSC redirects are
        // not reused after the anonymous session cookie has been set.
        window.location.assign("/chat");
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : t("Failed to sign in as guest. Please try again.");
        toast.error(message);
      }
    });
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={handleClick}
      disabled={isPending || isSubmitting}
    >
      {isSubmitting ? <Spinner className="size-4" /> : <User className="size-4" />}
      {t("Continue as Guest")}
    </Button>
  );
}
