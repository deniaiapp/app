import { tool } from "ai";
import { env } from "@/env";
import { createVeoAccessToken } from "@/lib/veo-access";
import { veoModelValues } from "@/lib/veo";
import { extractVeoErrorMessage, throwIfAborted } from "./helpers";
import { VEO_MAX_POLL_ATTEMPTS, VEO_POLL_INTERVAL_MS, veoToolInputSchema } from "./types";

function getGoogleApiKey() {
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Video generation is disabled in this environment.");
  }
  return apiKey;
}

async function pollVeoOperation(operationName: string, signal?: AbortSignal) {
  const apiKey = getGoogleApiKey();

  for (let attempt = 0; attempt < VEO_MAX_POLL_ATTEMPTS; attempt += 1) {
    throwIfAborted(signal);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}`,
      {
        headers: {
          "x-goog-api-key": apiKey,
        },
        signal,
      },
    );

    let responseData: unknown = null;
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }

    if (!response.ok) {
      console.error("Failed to check video status:", responseData);
      throw new Error(extractVeoErrorMessage(responseData, "Failed to check video status."));
    }

    const done =
      typeof responseData === "object" && responseData !== null
        ? Boolean((responseData as { done?: boolean }).done)
        : false;
    const errorMessage =
      typeof responseData === "object" && responseData !== null
        ? (responseData as { error?: { message?: string } }).error?.message
        : null;
    const videoUri =
      typeof responseData === "object" && responseData !== null
        ? ((
            responseData as {
              response?: {
                generateVideoResponse?: {
                  generatedSamples?: Array<{ video?: { uri?: string } }>;
                };
              };
            }
          ).response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ?? null)
        : null;

    if (done) {
      if (errorMessage) {
        throw new Error(errorMessage);
      }

      if (!videoUri) {
        throw new Error("Video generation finished without a file.");
      }

      return videoUri;
    }

    await new Promise((resolve) => setTimeout(resolve, VEO_POLL_INTERVAL_MS));
    throwIfAborted(signal);
  }

  throw new Error("Timed out waiting for the video.");
}

export function createVideoTool(userId?: string) {
  return tool({
    description:
      "Generate a short video with Veo. Provide a vivid visual prompt and optional settings.",
    inputSchema: veoToolInputSchema,
    execute: async (
      {
        prompt,
        model: requestedModel,
        negativePrompt,
        aspectRatio,
        resolution,
        durationSeconds,
        seed,
      },
      { abortSignal },
    ) => {
      const model = requestedModel ?? veoModelValues[0];
      const finalAspectRatio = aspectRatio ?? "16:9";
      const finalResolution = resolution ?? "720p";
      const finalDuration = finalResolution === "1080p" ? 8 : (durationSeconds ?? 6);
      const trimmedNegative = negativePrompt?.trim() || undefined;

      const instances: Record<string, unknown>[] = [
        {
          prompt,
        },
      ];

      const parameters: Record<string, unknown> = {
        aspectRatio: finalAspectRatio,
        resolution: finalResolution,
        durationSeconds: finalDuration,
      };

      if (trimmedNegative) {
        parameters.negativePrompt = trimmedNegative;
      }
      if (seed !== undefined) {
        parameters.seed = seed;
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": getGoogleApiKey(),
          },
          body: JSON.stringify({ instances, parameters }),
        },
      );

      let responseData: unknown = null;
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }

      if (!response.ok) {
        throw new Error(extractVeoErrorMessage(responseData, "Failed to start video generation."));
      }

      const operationName =
        typeof responseData === "object" && responseData !== null
          ? (responseData as { name?: string }).name
          : undefined;

      if (!operationName) {
        throw new Error("Missing operation name.");
      }

      const videoUri = await pollVeoOperation(operationName, abortSignal);
      const proxyUrl = `/api/veo/file?token=${encodeURIComponent(
        createVeoAccessToken({
          kind: "video",
          userId: userId ?? "anonymous",
          value: videoUri,
          ttlSeconds: 60 * 60,
        }),
      )}`;
      const modelLabel = model;

      return {
        videoUrl: proxyUrl,
        operationName,
        model,
        modelLabel,
        aspectRatio: finalAspectRatio,
        resolution: finalResolution,
        durationSeconds: finalDuration,
        seed: seed ?? null,
        negativePrompt: trimmedNegative ?? null,
      };
    },
  });
}
