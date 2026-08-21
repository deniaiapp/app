"use client";

import { Check, Copy, Globe, Lock, Share2, UserPlus, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc/react";

interface ShareDialogProps {
  chatId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ chatId, isOpen, onOpenChange }: ShareDialogProps) {
  const t = useExtracted();
  const [copied, setCopied] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const utils = trpc.useUtils();

  const shareSettings = trpc.share.getShareSettings.useQuery({ chatId }, { enabled: isOpen });

  const createShare = trpc.share.createShare.useMutation({
    onSuccess: () => {
      utils.share.getShareSettings.invalidate({ chatId });
      toast.success(t("Share settings updated"));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteShare = trpc.share.deleteShare.useMutation({
    onSuccess: () => {
      utils.share.getShareSettings.invalidate({ chatId });
      toast.success(t("Share link revoked"));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const addRecipient = trpc.share.addRecipient.useMutation({
    onSuccess: () => {
      utils.share.getShareSettings.invalidate({ chatId });
      setRecipientEmail("");
      toast.success(t("Recipient added"));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeRecipient = trpc.share.removeRecipient.useMutation({
    onSuccess: () => {
      utils.share.getShareSettings.invalidate({ chatId });
      toast.success(t("Recipient removed"));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const share = shareSettings.data;
  const shareUrl = share
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/shared/${share.id}`
    : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success(t("Link copied to clipboard"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateShare = (visibility: "public" | "private") => {
    createShare.mutate({ chatId, visibility, allowFork: true });
  };

  const handleToggleFork = (allowFork: boolean) => {
    createShare.mutate({
      chatId,
      visibility: share?.visibility ?? "public",
      allowFork,
    });
  };

  const handleVisibilityChange = (visibility: "public" | "private") => {
    if (share) {
      createShare.mutate({
        chatId,
        visibility,
        allowFork: share.allowFork,
      });
    }
  };

  const handleAddRecipient = () => {
    if (recipientEmail.trim()) {
      addRecipient.mutate({ chatId, recipientEmail: recipientEmail.trim() });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-5" />
            {t("Share Conversation")}
          </DialogTitle>
          <DialogDescription>
            {t("Share this conversation via link or with specific users.")}
          </DialogDescription>
        </DialogHeader>

        {shareSettings.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : !share ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("Choose how you want to share this conversation:")}
            </p>
            <div className="grid gap-4">
              <Button
                variant="outline"
                className="justify-start h-auto py-4"
                onClick={() => handleCreateShare("public")}
                disabled={createShare.isPending}
              >
                <Globe className="mr-3 size-5" />
                <div className="text-left">
                  <div className="font-medium">{t("Public Link")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("Anyone with the link can view")}
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-4"
                onClick={() => handleCreateShare("private")}
                disabled={createShare.isPending}
              >
                <Lock className="mr-3 size-5" />
                <div className="text-left">
                  <div className="font-medium">{t("Private Share")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("Only specific users can view")}
                  </div>
                </div>
              </Button>
            </div>
          </div>
        ) : (
          <Tabs
            value={share.visibility}
            onValueChange={(value) => handleVisibilityChange(value as "public" | "private")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="public">
                <Globe className="size-4" />
                {t("Public")}
              </TabsTrigger>
              <TabsTrigger value="private">
                <Lock className="size-4" />
                {t("Private")}
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>{t("Share Link")}</Label>
                <div className="flex gap-2">
                  <Input value={shareUrl} readOnly className="text-xs" />
                  <Button size="icon" variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("Allow Forking")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("Let viewers continue the conversation")}
                  </p>
                </div>
                <Switch checked={share.allowFork} onCheckedChange={handleToggleFork} />
              </div>

              <TabsContent value="private" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>{t("Share with Users")}</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("Enter email address")}
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.nativeEvent.isComposing &&
                          event.keyCode !== 229
                        ) {
                          event.preventDefault();
                          handleAddRecipient();
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      onClick={handleAddRecipient}
                      disabled={addRecipient.isPending || !recipientEmail.trim()}
                    >
                      {addRecipient.isPending ? (
                        <Spinner className="size-4" />
                      ) : (
                        <UserPlus className="size-4" />
                      )}
                    </Button>
                  </div>

                  {share.recipients && share.recipients.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {share.recipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          className="flex items-center justify-between p-2 bg-muted rounded-md"
                        >
                          <div className="text-sm">
                            <div>{recipient.name}</div>
                            <div className="text-xs text-muted-foreground">{recipient.email}</div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              removeRecipient.mutate({
                                chatId,
                                recipientId: recipient.id,
                              })
                            }
                            disabled={removeRecipient.isPending}
                          >
                            {removeRecipient.isPending ? (
                              <Spinner className="size-4" />
                            ) : (
                              <X className="size-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        )}

        <DialogFooter>
          {share && (
            <Button
              variant="destructive"
              onClick={() => deleteShare.mutate({ chatId })}
              disabled={deleteShare.isPending}
            >
              {deleteShare.isPending && <Spinner />}
              {t("Revoke Access")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
