"use client";

import { Plug, Trash2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useReducer } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettingsPageShell } from "@/components/settings-page-shell";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc/react";

const PROVIDER_IDS = ["openai", "anthropic", "google", "xai"] as const;

type ProviderId = (typeof PROVIDER_IDS)[number];
type ProviderConfig = {
  id: ProviderId;
  label: string;
  description: string;
};

const defaultKeyState = PROVIDER_IDS.reduce(
  (acc, providerId) => {
    acc[providerId] = "";
    return acc;
  },
  {} as Record<ProviderId, string>,
);

const defaultPreferState = PROVIDER_IDS.reduce(
  (acc, providerId) => {
    acc[providerId] = false;
    return acc;
  },
  {} as Record<ProviderId, boolean>,
);

type ProvidersUiState = {
  keyInputs: Record<ProviderId, string>;
  preferByok: Record<ProviderId, boolean>;
};

type ProvidersUiAction =
  | {
      type: "syncSettings";
      preferByok: Record<ProviderId, boolean>;
    }
  | { type: "setKeyInput"; providerId: ProviderId; value: string }
  | { type: "saveKeySuccess"; providerId: ProviderId }
  | { type: "setPreferByok"; providerId: ProviderId; value: boolean };

const DEFAULT_PROVIDERS_UI_STATE: ProvidersUiState = {
  keyInputs: defaultKeyState,
  preferByok: defaultPreferState,
};

function providersUiReducer(state: ProvidersUiState, action: ProvidersUiAction): ProvidersUiState {
  switch (action.type) {
    case "syncSettings":
      return {
        ...state,
        preferByok: action.preferByok,
      };
    case "setKeyInput":
      return {
        ...state,
        keyInputs: {
          ...state.keyInputs,
          [action.providerId]: action.value,
        },
      };
    case "saveKeySuccess":
      return {
        ...state,
        preferByok: {
          ...state.preferByok,
          [action.providerId]: true,
        },
        keyInputs: {
          ...state.keyInputs,
          [action.providerId]: "",
        },
      };
    case "setPreferByok":
      return {
        ...state,
        preferByok: {
          ...state.preferByok,
          [action.providerId]: action.value,
        },
      };
  }
}

export default function ProvidersPage() {
  const t = useExtracted();
  const utils = trpc.useUtils();
  const configQuery = trpc.providers.getConfig.useQuery();
  const upsertKey = trpc.providers.upsertKey.useMutation();
  const deleteKey = trpc.providers.deleteKey.useMutation();
  const upsertSetting = trpc.providers.upsertSetting.useMutation();

  const [providersUi, dispatchProvidersUi] = useReducer(
    providersUiReducer,
    DEFAULT_PROVIDERS_UI_STATE,
  );
  const { keyInputs, preferByok } = providersUi;
  const providers: ProviderConfig[] = [
    {
      id: "openai",
      label: t("OpenAI"),
      description: t("Use your own OpenAI API key."),
    },
    {
      id: "anthropic",
      label: t("Anthropic"),
      description: t("Use your own Anthropic API key."),
    },
    {
      id: "google",
      label: t("Google"),
      description: t("Use your own Google Generative AI key."),
    },
    {
      id: "xai",
      label: t("xAI"),
      description: t("Use your own xAI API key."),
    },
  ];

  const settingsByProvider = (() => {
    const map = new Map<ProviderId, { preferByok: boolean; baseUrl?: string | null }>();
    for (const setting of configQuery.data?.settings ?? []) {
      if (!(PROVIDER_IDS as readonly string[]).includes(setting.provider)) continue;
      map.set(setting.provider as ProviderId, {
        preferByok: setting.preferByok,
        baseUrl: setting.baseUrl ?? null,
      });
    }
    return map;
  })();

  const configuredProviders = new Set(
    (configQuery.data?.keys ?? []).map((entry) => entry.provider),
  );

  useEffect(() => {
    if (!configQuery.data) return;
    const nextPrefer = { ...defaultPreferState };
    for (const providerId of PROVIDER_IDS) {
      const setting = settingsByProvider.get(providerId);
      nextPrefer[providerId] = setting?.preferByok ?? false;
    }
    dispatchProvidersUi({
      type: "syncSettings",
      preferByok: nextPrefer,
    });
  }, [configQuery.data, settingsByProvider]);

  const handleSaveKey = async (providerId: ProviderId) => {
    const value = keyInputs[providerId]?.trim();
    if (!value) {
      toast.error(t("Enter an API key first."));
      return;
    }

    try {
      await Promise.all([
        upsertKey.mutateAsync({ provider: providerId, apiKey: value }),
        upsertSetting.mutateAsync({
          provider: providerId,
          preferByok: true,
        }),
      ]);
      dispatchProvidersUi({ type: "saveKeySuccess", providerId });
      await utils.providers.getConfig.invalidate();
      toast.success(t("API key saved."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to save API key."));
    }
  };

  const handleDeleteKey = async (providerId: ProviderId) => {
    try {
      await deleteKey.mutateAsync({ provider: providerId });
      await utils.providers.getConfig.invalidate();
      toast.success(t("API key removed."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to remove API key."));
    }
  };

  const handlePreferToggle = async (providerId: ProviderId, value: boolean) => {
    const previousValue = preferByok[providerId];
    dispatchProvidersUi({ type: "setPreferByok", providerId, value });
    try {
      await upsertSetting.mutateAsync({
        provider: providerId,
        preferByok: value,
      });
      await utils.providers.getConfig.invalidate();
    } catch (error) {
      // Roll back the optimistic update so the toggle reflects server truth.
      dispatchProvidersUi({ type: "setPreferByok", providerId, value: previousValue });
      toast.error(error instanceof Error ? error.message : t("Failed to update preference."));
    }
  };

  if (configQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <SettingsPageShell
      title={t("Providers")}
      description={t("Bring your own keys and configure custom endpoints")}
    >
      <div>
        <div className="mb-4">
          <CardTitle className="text-sm font-medium">{t("API Keys (BYOK)")}</CardTitle>
          <CardDescription>
            {t(
              "Saved keys are encrypted. BYOK model requests are not counted toward usage limits. Web search still uses platform quota.",
            )}
          </CardDescription>
        </div>

        <div className="flex flex-col gap-3">
          {providers.map((provider) => {
            const configured = configuredProviders.has(provider.id);
            const prefer = preferByok[provider.id] ?? false;
            const inputId = `provider-key-${provider.id}`;
            return (
              <div
                key={provider.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <Plug className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold">{provider.label}</p>
                      <p className="text-xs text-muted-foreground">{provider.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {configured && (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                        {t("Configured")}
                      </Badge>
                    )}
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`prefer-${provider.id}`}
                        className="text-xs text-muted-foreground"
                      >
                        {t("Prefer BYOK")}
                      </Label>
                      <Switch
                        id={`prefer-${provider.id}`}
                        checked={prefer}
                        onCheckedChange={(checked) =>
                          handlePreferToggle(provider.id, Boolean(checked))
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <div className="flex-1">
                    <Label htmlFor={inputId} className="sr-only">
                      {t("{provider} API key", {
                        provider: provider.label,
                      })}
                    </Label>
                    <Input
                      id={inputId}
                      type="password"
                      placeholder={t("sk-••••")}
                      value={keyInputs[provider.id]}
                      onChange={(event) =>
                        dispatchProvidersUi({
                          type: "setKeyInput",
                          providerId: provider.id,
                          value: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSaveKey(provider.id)}
                      disabled={upsertKey.isPending}
                    >
                      {configured ? t("Update") : t("Save")}
                    </Button>
                    {configured && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteKey(provider.id)}
                        disabled={deleteKey.isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SettingsPageShell>
  );
}
