import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateImage } from "ai";
import { env } from "@/env";
import {
  type ImageModel,
  supportsImageHighResolution,
  type ImageAspectRatio,
  type ImageResolution,
} from "@/lib/image";

export type GeneratedImage = {
  imageBytes: string;
  mimeType: string;
};

function getGoogleProvider() {
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Image generation is disabled in this environment.");
  }

  return createGoogleGenerativeAI({ apiKey });
}

function toGeneratedImages(images: Array<{ base64: string; mediaType: string }>): GeneratedImage[] {
  return images.map((image) => ({
    imageBytes: image.base64,
    mimeType: image.mediaType,
  }));
}

function buildGeminiProviderOptions(
  model: ImageModel,
  aspectRatio?: ImageAspectRatio,
  resolution?: ImageResolution,
) {
  const imageConfig = {
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(resolution && supportsImageHighResolution(model) ? { imageSize: resolution } : {}),
  };

  return {
    google: Object.keys(imageConfig).length > 0 ? { imageConfig } : {},
  };
}

export async function generateImages({
  prompt,
  model,
  aspectRatio,
  resolution,
  numberOfImages = 1,
  signal,
}: {
  prompt: string;
  model: ImageModel;
  aspectRatio?: ImageAspectRatio;
  resolution?: ImageResolution;
  numberOfImages?: number;
  signal?: AbortSignal;
}): Promise<GeneratedImage[]> {
  const google = getGoogleProvider();
  const providerOptions = buildGeminiProviderOptions(model, aspectRatio, resolution);
  const geminiModel = google.image(model);

  const tasks: ReturnType<typeof generateImage>[] = [];
  for (let index = 0; index < numberOfImages; index += 1) {
    tasks.push(
      generateImage({
        model: geminiModel,
        prompt,
        ...(aspectRatio ? { aspectRatio } : {}),
        providerOptions,
        abortSignal: signal,
      }),
    );
  }
  const results = await Promise.all(tasks);

  const images: GeneratedImage[] = [];
  for (const result of results) {
    images.push(...toGeneratedImages(result.images));
  }
  return images;
}
