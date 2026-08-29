import { type AnthropicProviderOptions, createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI, type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createXai, type XaiProviderOptions } from "@ai-sdk/xai";
import { createOpenAI, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { LanguageModel, ModelMessage, SystemModelMessage } from "ai";
import { streamText } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { providerKey, providerSetting } from "@/db/schema";
import { env } from "@/env";
import { decryptFromB64 } from "@/lib/crypto";
import { isFreePlanModel, models, resolveReasoningEffort } from "@/lib/constants";
import { assertSafePublicHttpUrl } from "@/lib/network-security";
import { createDeniOpenRouter } from "@/lib/openrouter-provider";
import { isModelProviderAvailable } from "@/lib/platform-capabilities";
import { platformCapabilities } from "@/lib/platform-capabilities.server";
import { getUsageSummary, type UsageCategory, UsageLimitError } from "@/lib/usage";

const DEFAULT_VOIDS_BASE_URL = "https://capi.voids.top/v2";

const openaiEffortOptions = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
const anthropicEffortOptions = ["low", "medium", "high", "max"] as const;
const googleThinkingLevels = ["minimal", "low", "medium", "high"] as const;
const anthropicBudgetModelIds = new Set(["claude-opus-4.1", "claude-opus-4", "claude-sonnet-4"]);

export class ChatRouteError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === "string" ? body.error : "Chat route error");
    this.status = status;
    this.body = body;
  }
}

const OPENROUTER_CACHE_CONTROL = {
  type: "ephemeral",
  ttl: "1h",
} as const;

type ResolveChatModelContextParams = {
  userId: string;
  isAnonymous: boolean;
  baseModel: string;
  reasoningEffort: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  /** GPT-5.6 Pro reasoning mode (`reasoning.mode: "pro"`). */
  proMode?: boolean;
  /** OpenAI Fast mode (`service_tier: "fast"`). */
  fastMode?: boolean;
};

type ChatProviderOptions = NonNullable<Parameters<typeof streamText>[0]["providerOptions"]>;

type ResolvedChatModelContext = {
  model: LanguageModel;
  useByok: boolean;
  usesOpenRouter: boolean;
  usageCategory: UsageCategory;
  usageUnit: "requests" | "tokens";
  providerOptions: ChatProviderOptions;
};

function mergeProviderOptions(
  existing: ChatProviderOptions | undefined,
  additions: ChatProviderOptions,
): ChatProviderOptions {
  return {
    ...existing,
    ...additions,
  };
}

export function addOpenRouterCacheControl(
  messages: ModelMessage[],
  system: string,
): { messages: ModelMessage[]; system: SystemModelMessage } {
  const cacheProviderOptions = {
    openrouter: {
      cacheControl: OPENROUTER_CACHE_CONTROL,
    },
  } satisfies ChatProviderOptions;

  return {
    system: {
      role: "system",
      content: system,
      providerOptions: cacheProviderOptions,
    },
    messages: messages.map((message) => {
      if (typeof message.content === "string") {
        return {
          ...message,
          providerOptions: mergeProviderOptions(message.providerOptions, cacheProviderOptions),
        } as ModelMessage;
      }

      return {
        ...message,
        content: message.content.map((part) =>
          part.type === "text"
            ? {
                ...part,
                providerOptions: mergeProviderOptions(part.providerOptions, cacheProviderOptions),
              }
            : part,
        ),
      } as ModelMessage;
    }),
  };
}

export async function resolveChatModelContext({
  userId,
  isAnonymous,
  baseModel,
  reasoningEffort,
  proMode = false,
  fastMode = false,
}: ResolveChatModelContextParams): Promise<ResolvedChatModelContext> {
  const selectedModel = models.find((model) => model.value === baseModel);

  if (!selectedModel) {
    throw new ChatRouteError(400, { error: "Unknown model" });
  }

  let usageUnit: "requests" | "tokens" = "requests";
  const [providerKeys, providerSettings] = await Promise.all([
    db.select().from(providerKey).where(eq(providerKey.userId, userId)),
    db.select().from(providerSetting).where(eq(providerSetting.userId, userId)),
  ]);

  const providerKeyMap = new Map(providerKeys.map((entry) => [entry.provider, entry.keyEnc]));
  const providerSettingMap = new Map(providerSettings.map((entry) => [entry.provider, entry]));
  const providerId = selectedModel.provider ?? selectedModel.author;
  const anthropicApiKey = env.ANTHROPIC_API_KEY?.trim();
  const groqApiKey = env.GROQ_API_KEY?.trim();

  if (!providerId) {
    throw new ChatRouteError(400, { error: "Unknown provider" });
  }

  let useByok = false;
  let byokApiKey: string | undefined;
  let byokBaseUrl: string | undefined;

  const keyEnc = providerKeyMap.get(providerId);
  const setting = providerSettingMap.get(providerId);
  const preferByok = setting?.preferByok ?? false;

  const platformModelAvailable = isModelProviderAvailable(platformCapabilities, providerId);
  if (keyEnc && (preferByok || !platformModelAvailable)) {
    byokApiKey = await decryptFromB64(keyEnc);
    byokBaseUrl = setting?.baseUrl ?? undefined;
    useByok = true;
  }

  if (!useByok && !platformModelAvailable) {
    throw new ChatRouteError(503, {
      error: "This model is not configured in the current environment.",
    });
  }

  if (providerId === "xai" && useByok && !byokBaseUrl) {
    byokBaseUrl = "https://api.x.ai/v1";
  }

  if (byokBaseUrl) {
    try {
      await assertSafePublicHttpUrl(byokBaseUrl);
    } catch {
      throw new ChatRouteError(400, {
        error: "BYOK endpoints to private networks are not allowed.",
      });
    }
  }

  // voids.top is opt-in via VOIDS_MODE plus VOIDS_API_KEY. When both are
  // enabled, platform (non-BYOK) OpenAI + Anthropic traffic uses the gateway.
  // Otherwise OpenAI/xAI use OpenRouter, while Google and Anthropic prefer their
  // native platform keys and fall back to OpenRouter when those keys are absent.
  // BYOK always keeps native provider SDKs.
  const voidsModeEnabled = Boolean(env.VOIDS_MODE);
  const voidsKeyConfigured = Boolean(env.VOIDS_API_KEY?.trim());
  const usesVoids =
    voidsModeEnabled &&
    voidsKeyConfigured &&
    !useByok &&
    (providerId === "openai" || providerId === "anthropic");
  const usesOpenRouter =
    !useByok &&
    !usesVoids &&
    (providerId === "openai" ||
      providerId === "google" ||
      providerId === "xai" ||
      (providerId === "anthropic" && !anthropicApiKey));
  // Pro: BYOK OpenAI uses reasoning.mode; OpenRouter uses `*-pro` slug.
  // Fast: BYOK OpenAI uses service_tier; OpenRouter uses top-level service_tier.
  // voids.top has neither, so Pro and Fast are disabled on the voids path.
  const useProMode = Boolean(
    proMode &&
    selectedModel.supportsProMode &&
    providerId === "openai" &&
    (useByok || usesOpenRouter),
  );
  const useFastMode = Boolean(
    fastMode &&
    selectedModel.supportsFastMode &&
    providerId === "openai" &&
    (useByok || usesOpenRouter),
  );
  const isPremiumModel = Boolean(selectedModel.premium);
  // Pro mode always bills against premium quota (even when the base model is basic).
  const usageCategory: UsageCategory = isPremiumModel || useProMode ? "premium" : "basic";
  const modelAllowedOnFreePlan = isFreePlanModel(selectedModel.value);

  // Free plan / guest sessions are limited to the free-plan model allowlist.
  // Paid tiers unlock the full catalog. Check tier even for BYOK so free users
  // cannot bypass the allowlist with their own keys.
  // Usage limits still apply for non-BYOK traffic.
  const needsUsageSummary = !useByok || !modelAllowedOnFreePlan;

  if (needsUsageSummary) {
    try {
      const usageSummary = await getUsageSummary({ userId, isAnonymous });

      if (!modelAllowedOnFreePlan && (isAnonymous || usageSummary.tier === "free")) {
        throw new ChatRouteError(403, {
          error:
            "This model is not available on the Free plan. Upgrade to Plus or higher to use it.",
        });
      }

      if (isAnonymous && usageCategory === "premium") {
        throw new ChatRouteError(403, {
          error: useProMode
            ? "Pro mode is not available for guest sessions."
            : "Premium models are not available for guest sessions.",
        });
      }

      if (!useByok) {
        const categoryUsage = usageSummary.usage.find((usage) => usage.category === usageCategory);
        usageUnit = categoryUsage?.unit ?? "requests";
        const isLimitReached =
          categoryUsage?.remaining !== null &&
          categoryUsage?.remaining !== undefined &&
          categoryUsage.remaining <= 0;

        if (isLimitReached && !usageSummary.maxModeEnabled) {
          throw new UsageLimitError(
            "You've hit the usage limit for your plan.",
            usageSummary.maxModeEligible,
          );
        }
      }
    } catch (error) {
      if (error instanceof ChatRouteError) {
        throw error;
      }
      if (error instanceof UsageLimitError) {
        throw new ChatRouteError(402, {
          error: error.message,
          reason: "usage_limit",
        });
      }

      console.error("Failed to check usage", error);
      throw new ChatRouteError(500, { error: "Unable to check usage" });
    }
  } else if (isAnonymous && usageCategory === "premium") {
    // BYOK path with a free-plan model + Pro mode: still block guests.
    throw new ChatRouteError(403, {
      error: "Pro mode is not available for guest sessions.",
    });
  }

  // OpenRouter exposes GPT-5.6 Pro as `*-pro`. voids.top does not — keep base id there.
  const resolvedModelId =
    useProMode && usesOpenRouter ? `${selectedModel.value}-pro` : selectedModel.value;

  const resolvedReasoningEffort = resolveReasoningEffort(
    selectedModel?.efforts ?? false,
    reasoningEffort,
  );
  const openaiReasoningEffort =
    providerId === "openai" &&
    resolvedReasoningEffort &&
    openaiEffortOptions.includes(resolvedReasoningEffort as (typeof openaiEffortOptions)[number])
      ? (resolvedReasoningEffort as (typeof openaiEffortOptions)[number])
      : undefined;
  const openaiReasoningMode =
    providerId === "openai" && useProMode && useByok ? ("pro" as const) : undefined;
  const openaiServiceTier =
    providerId === "openai" && useFastMode && useByok ? ("fast" as const) : undefined;
  // Anthropic-native options only apply on BYOK Anthropic (or direct Anthropic SDK).
  // voids.top is OpenAI-compatible and does not accept Anthropic providerOptions.
  const anthropicReasoningEffort =
    providerId === "anthropic" &&
    !usesVoids &&
    !usesOpenRouter &&
    !anthropicBudgetModelIds.has(selectedModel?.value ?? "") &&
    resolvedReasoningEffort &&
    anthropicEffortOptions.includes(
      resolvedReasoningEffort as (typeof anthropicEffortOptions)[number],
    )
      ? (resolvedReasoningEffort as (typeof anthropicEffortOptions)[number])
      : undefined;
  const anthropicThinkingBudget =
    providerId === "anthropic" &&
    !usesVoids &&
    !usesOpenRouter &&
    anthropicBudgetModelIds.has(selectedModel?.value ?? "") &&
    resolvedReasoningEffort
      ? resolvedReasoningEffort === "low"
        ? 5_000
        : resolvedReasoningEffort === "medium"
          ? 10_000
          : resolvedReasoningEffort === "high"
            ? 15_000
            : undefined
      : undefined;
  const googleThinkingLevel =
    providerId === "google" &&
    resolvedReasoningEffort &&
    googleThinkingLevels.includes(resolvedReasoningEffort as (typeof googleThinkingLevels)[number])
      ? (resolvedReasoningEffort as (typeof googleThinkingLevels)[number])
      : undefined;
  const xaiReasoningEffort =
    providerId === "xai" &&
    (resolvedReasoningEffort === "low" || resolvedReasoningEffort === "high")
      ? resolvedReasoningEffort
      : undefined;

  // OpenRouter uses `x-ai/...` for xAI models (not `xai/...`).
  const openRouterAuthor = selectedModel.author === "xai" ? "x-ai" : selectedModel.author;
  const selectedOpenRouterModelId = selectedModel
    ? resolvedModelId.includes("/")
      ? resolvedModelId
      : `${openRouterAuthor}/${resolvedModelId}`
    : null;
  const getOpenRouterModel = () => {
    if (!selectedOpenRouterModelId) {
      throw new Error("OpenRouter model is not available for the selected model.");
    }
    const apiKey = env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new ChatRouteError(503, {
        error: "OpenRouter is not configured in the current environment.",
      });
    }

    const openrouter = createDeniOpenRouter({
      apiKey,
    });

    return openrouter.chat(selectedOpenRouterModelId, {
      provider: {
        allow_fallbacks: false,
        only: ["openai", "anthropic", "google-ai-studio", "xai"],
      },
    });
  };
  const getAnthropicModel = (apiKey: string | undefined, baseURL?: string) => {
    if (!apiKey?.trim()) {
      throw new ChatRouteError(503, {
        error: "Anthropic is not configured in the current environment.",
      });
    }

    const provider = createAnthropic({
      apiKey,
      baseURL,
    });

    return provider(resolvedModelId.replace(".", "-"));
  };
  const getVoidsModel = () => {
    const apiKey = env.VOIDS_API_KEY?.trim();
    if (!apiKey) {
      throw new ChatRouteError(500, {
        error:
          "VOIDS_API_KEY is required when VOIDS_MODE is enabled. Set a valid voids.top API key in the environment.",
      });
    }

    const provider = createOpenAI({
      apiKey,
      baseURL: env.VOIDS_BASE_URL || DEFAULT_VOIDS_BASE_URL,
      name: "voids",
    });
    // voids.top speaks the Chat Completions API with OpenAI-style model ids
    // (e.g. gpt-5.6-sol, claude-fable-5). Keep the id as declared in constants.
    return provider.chat(resolvedModelId);
  };

  const anthropicOptions: AnthropicProviderOptions = {};
  if (anthropicReasoningEffort) {
    anthropicOptions.effort = anthropicReasoningEffort;
  }
  if (anthropicThinkingBudget) {
    anthropicOptions.thinking = {
      type: "enabled",
      budgetTokens: anthropicThinkingBudget,
    };
  }

  let model: LanguageModel;
  switch (providerId) {
    case "openai": {
      if (useByok) {
        const provider = createOpenAI({
          apiKey: byokApiKey,
          baseURL: byokBaseUrl,
        });
        model = provider.responses(resolvedModelId);
      } else if (usesVoids) {
        model = getVoidsModel();
      } else {
        model = getOpenRouterModel();
      }
      break;
    }
    case "anthropic": {
      if (useByok) {
        model = getAnthropicModel(byokApiKey, byokBaseUrl);
      } else if (usesVoids) {
        model = getVoidsModel();
      } else if (anthropicApiKey) {
        model = getAnthropicModel(anthropicApiKey);
      } else {
        model = getOpenRouterModel();
      }
      break;
    }
    case "google": {
      if (useByok) {
        const provider = createGoogleGenerativeAI({
          apiKey: byokApiKey,
          baseURL: byokBaseUrl,
        });
        model = provider(resolvedModelId);
      } else {
        model = getOpenRouterModel();
      }
      break;
    }
    case "xai": {
      if (useByok) {
        const provider = createXai({
          apiKey: byokApiKey,
          baseURL: byokBaseUrl,
        });
        model = provider.chat(resolvedModelId.replace("xai.", ""));
      } else {
        model = getOpenRouterModel();
      }
      break;
    }
    case "groq": {
      if (useByok) {
        const provider = createGroq({
          apiKey: byokApiKey,
          baseURL: byokBaseUrl,
        });
        model = provider(resolvedModelId);
      } else if (!groqApiKey) {
        throw new ChatRouteError(503, {
          error: "Groq is not configured in the current environment.",
        });
      } else {
        model = createGroq({
          apiKey: groqApiKey,
        })(resolvedModelId);
      }
      break;
    }
    default:
      throw new ChatRouteError(400, { error: "Unknown provider" });
  }

  const openaiProviderOptions: OpenAIResponsesProviderOptions | undefined =
    openaiReasoningEffort || openaiReasoningMode || openaiServiceTier
      ? {
          ...(openaiReasoningEffort
            ? {
                reasoningEffort: openaiReasoningEffort,
                reasoningSummary: "detailed" as const,
              }
            : {}),
          ...(openaiReasoningMode ? { reasoningMode: openaiReasoningMode } : {}),
          ...(openaiServiceTier ? { serviceTier: openaiServiceTier } : {}),
        }
      : undefined;

  const directProviderOptions = {
    ...(openaiProviderOptions
      ? {
          openai: openaiProviderOptions,
        }
      : {}),
    ...(Object.keys(anthropicOptions).length > 0
      ? {
          anthropic: anthropicOptions,
        }
      : {}),
    ...(googleThinkingLevel
      ? {
          google: {
            thinkingConfig: {
              thinkingLevel: googleThinkingLevel,
              includeThoughts: true,
            },
          } satisfies GoogleGenerativeAIProviderOptions,
        }
      : {}),
    ...(xaiReasoningEffort
      ? {
          xai: {
            reasoningEffort: xaiReasoningEffort,
          } satisfies XaiProviderOptions,
        }
      : {}),
  };

  // When routing through OpenRouter, wrap provider-specific options so they are
  // forwarded in OpenRouter-compatible format. voids.top only understands OpenAI
  // chat-style options (and only for OpenAI-authored models).
  const openRouterBody = usesOpenRouter
    ? {
        ...(Object.keys(directProviderOptions).length > 0
          ? { providerOptions: directProviderOptions }
          : {}),
        ...(useFastMode ? { service_tier: "fast" as const } : {}),
      }
    : undefined;
  const providerOptions: ChatProviderOptions = (
    usesVoids
      ? providerId === "openai" && openaiProviderOptions
        ? { openai: openaiProviderOptions }
        : {}
      : useByok || (!usesOpenRouter && !usesVoids)
        ? directProviderOptions
        : openRouterBody && Object.keys(openRouterBody).length > 0
          ? { openrouter: openRouterBody }
          : {}
  ) as ChatProviderOptions;

  return {
    model,
    useByok,
    usesOpenRouter,
    usageCategory,
    usageUnit,
    providerOptions,
  };
}
