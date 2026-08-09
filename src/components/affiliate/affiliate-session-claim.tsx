"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/react";

export function AffiliateSessionClaim() {
  const hasAttemptedRef = useRef(false);
  const { mutate } = trpc.affiliate.claim.useMutation();

  useEffect(() => {
    if (hasAttemptedRef.current) {
      return;
    }

    hasAttemptedRef.current = true;
    mutate();
  }, [mutate]);

  return null;
}
