"use client";

import { useAuth } from "@better-auth-ui/react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FreshSessionPrompt } from "./fresh-session-prompt";

export type FreshSessionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
};

/**
 * Modal wrapper around `FreshSessionPrompt` for call sites where the re-auth
 * prompt should interrupt the user (e.g. after clicking a button) rather
 * than being shown inline.
 */
export function FreshSessionDialog({ open, onOpenChange, onVerified }: FreshSessionDialogProps) {
  const { localization } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{localization.settings.freshSessionTitle}</DialogTitle>
          <DialogDescription>{localization.settings.freshSessionDescription}</DialogDescription>
        </DialogHeader>

        <FreshSessionPrompt onVerified={onVerified} />
      </DialogContent>
    </Dialog>
  );
}
