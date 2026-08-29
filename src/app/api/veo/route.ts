import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportMaxModeUsageToStripe } from "@/lib/max-mode";
import { consumeUsage, refundUsage, UsageLimitError } from "@/lib/usage";
import { createVeoAccessToken, verifyVeoAccessToken } from "@/lib/veo-access";
import { veoAspectRatios, veoDurations, veoModelValues, veoResolutions } from "@/lib/veo";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function getGoogleApiKey() {
  return env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || null;
}

const requestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  model: z.enum(veoModelValues),
  negativePrompt: z.string().max(2000).optional(),
  aspectRatio: z.enum(veoAspectRatios).optional(),
  resolution: z.enum(veoResolutions).optional(),
  durationSeconds: z
    .number()
    .int()
    .refine((value) => veoDurations.some((duration) => duration === value), {
      message: "Invalid duration",
    })
    .optional(),
  seed: z.number().int().min(0).max(2_147_483_647).optional(),
  image: z
    .object({
      imageBytes: z.string().min(1),
      mimeType: z.string().min(1),
    })
    .optional(),
});

const operationNameSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => /^[a-zA-Z0-9/-]+$/.test(value) && !value.includes(".."), {
    message: "Invalid operation name.",
  });

export async function POST(req: Request) {
  const googleApiKey = getGoogleApiKey();
  if (!googleApiKey) {
    return NextResponse.json(
      { error: "Video generation is disabled in this environment." },
      { status: 503 },
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.session.userId;
  const isAnonymous = Boolean(session.user?.isAnonymous);

  const rateCheck = await checkRateLimit({
    key: `veo:${userId}`,
    windowMs: 60_000,
    maxRequests: 5,
  });
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const data = parsedBody.data;
  if (data.resolution === "1080p" && data.durationSeconds !== 8) {
    return NextResponse.json(
      { error: "1080p output requires 8 seconds duration." },
      { status: 400 },
    );
  }

  // Billed to Stripe only once the request actually succeeds: every failure path
  // below refunds the reservation, and a meter event cannot be taken back.
  let pendingMaxModeAmount = 0;

  try {
    const consumed = await consumeUsage({ userId, category: "premium", isAnonymous });
    pendingMaxModeAmount = consumed.maxModeAmount;
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json({ error: error.message, reason: "usage_limit" }, { status: 402 });
    }
    return NextResponse.json({ error: "Unable to check usage" }, { status: 500 });
  }

  const instances: Record<string, unknown>[] = [
    {
      prompt: data.prompt,
      ...(data.image ? { image: data.image } : {}),
    },
  ];

  const parameters: Record<string, unknown> = {};
  if (data.negativePrompt) {
    parameters.negativePrompt = data.negativePrompt;
  }
  if (data.aspectRatio) {
    parameters.aspectRatio = data.aspectRatio;
  }
  if (data.resolution) {
    parameters.resolution = data.resolution;
  }
  if (data.durationSeconds) {
    parameters.durationSeconds = data.durationSeconds;
  }
  if (data.seed !== undefined) {
    parameters.seed = data.seed;
  }

  const payload = Object.keys(parameters).length > 0 ? { instances, parameters } : { instances };

  try {
    const response = await fetch(`${BASE_URL}/models/${data.model}:predictLongRunning`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": googleApiKey,
      },
      body: JSON.stringify(payload),
    });

    let responseData: unknown = null;
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }

    if (!response.ok) {
      await refundUsage({ userId, category: "premium" });
      console.error("Video generation API error:", responseData);
      return NextResponse.json({ error: "Video generation failed" }, { status: response.status });
    }

    const operationName =
      typeof responseData === "object" && responseData !== null
        ? (responseData as { name?: string }).name
        : undefined;

    if (!operationName) {
      await refundUsage({ userId, category: "premium" });
      return NextResponse.json({ error: "Missing operation name." }, { status: 500 });
    }

    await reportMaxModeUsageToStripe(userId, "premium", pendingMaxModeAmount);

    return NextResponse.json({
      operationName,
      operationToken: createVeoAccessToken({
        kind: "operation",
        userId,
        value: operationName,
        ttlSeconds: 60 * 60,
      }),
    });
  } catch (error) {
    await refundUsage({ userId, category: "premium" });
    console.error("Video generation request failed:", error);
    return NextResponse.json({ error: "Video generation failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const googleApiKey = getGoogleApiKey();
  if (!googleApiKey) {
    return NextResponse.json(
      { error: "Video generation is disabled in this environment." },
      { status: 503 },
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing operation token." }, { status: 400 });
  }

  const operationName = verifyVeoAccessToken(token, "operation", session.session.userId);
  const parsedName = operationNameSchema.safeParse(operationName);
  if (!parsedName.success) {
    return NextResponse.json({ error: "Invalid operation token." }, { status: 400 });
  }

  const response = await fetch(`${BASE_URL}/${parsedName.data}`, {
    headers: {
      "x-goog-api-key": googleApiKey,
    },
  });

  let responseData: unknown = null;
  try {
    responseData = await response.json();
  } catch {
    responseData = null;
  }

  if (!response.ok) {
    console.error("Video status check API error:", responseData);
    return NextResponse.json({ error: "Failed to check status." }, { status: response.status });
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

  const videoUrl = videoUri
    ? `/api/veo/file?token=${encodeURIComponent(
        createVeoAccessToken({
          kind: "video",
          userId: session.session.userId,
          value: videoUri,
          ttlSeconds: 60 * 60,
        }),
      )}`
    : null;

  return NextResponse.json({ done, error: errorMessage, videoUrl });
}
