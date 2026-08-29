import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { verifyVeoAccessToken } from "@/lib/veo-access";

const GOOGLE_API_ORIGIN = "https://generativelanguage.googleapis.com";
const ALLOWED_FILE_PATHS = [
  /^\/v1beta\/files\/[A-Za-z0-9._-]+(?::[A-Za-z0-9._-]+)?$/,
  /^\/download\/v1beta\/files\/[A-Za-z0-9._-]+(?::[A-Za-z0-9._-]+)?$/,
];

function getTrustedGoogleFileUrl(uri: string) {
  let parsed: URL;

  try {
    parsed = new URL(uri);
  } catch {
    return null;
  }

  if (parsed.origin !== GOOGLE_API_ORIGIN) {
    return null;
  }

  if (!ALLOWED_FILE_PATHS.some((pattern) => pattern.test(parsed.pathname))) {
    return null;
  }

  const searchParams = new URLSearchParams(parsed.search);
  if (searchParams.has("alt") && searchParams.get("alt") !== "media") {
    return null;
  }

  for (const key of searchParams.keys()) {
    if (key !== "alt") {
      return null;
    }
  }

  const trustedUrl = new URL(parsed.pathname, GOOGLE_API_ORIGIN);
  if (searchParams.has("alt")) {
    trustedUrl.searchParams.set("alt", "media");
  }

  return trustedUrl.toString();
}

export async function GET(req: Request) {
  const googleApiKey = env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
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
  const uri = token ? verifyVeoAccessToken(token, "video", session.session.userId) : null;
  const trustedUri = uri ? getTrustedGoogleFileUrl(uri) : null;
  if (!trustedUri) {
    return NextResponse.json({ error: "Missing or invalid video token." }, { status: 400 });
  }

  const response = await fetch(trustedUri, {
    headers: {
      "x-goog-api-key": googleApiKey,
    },
  });

  if (!response.ok) {
    let message = "Failed to download video.";
    try {
      const errorJson = (await response.json()) as {
        error?: { message?: string };
      };
      message = errorJson?.error?.message ?? message;
    } catch {
      message = response.statusText || message;
    }
    return NextResponse.json({ error: message }, { status: response.status });
  }

  const contentType = response.headers.get("content-type") ?? "video/mp4";
  const contentLength = response.headers.get("content-length");

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      ...(contentLength ? { "Content-Length": contentLength } : {}),
      "Cache-Control": "no-store",
    },
  });
}
