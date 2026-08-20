import { tool } from "ai";
import { generateImages } from "@/lib/image-generation";
import { imageModelValues, resolveImageModelLabel, supportsImageHighResolution } from "@/lib/image";
import { uploadImage } from "@/lib/upload";
import { imageToolInputSchema } from "./types";

export function createImageTool() {
  return tool({
    description:
      "Generate images with Nano Banana. Provide a vivid visual prompt and optional settings.",
    inputSchema: imageToolInputSchema,
    execute: async (
      { prompt, model: requestedModel, aspectRatio, resolution, numberOfImages },
      { abortSignal },
    ) => {
      const model = requestedModel ?? imageModelValues[0];
      const finalAspectRatio = aspectRatio ?? "1:1";
      const finalResolution = resolution ?? "1K";
      const effectiveResolution = supportsImageHighResolution(model) ? finalResolution : "1K";
      const finalNumberOfImages = numberOfImages ?? 1;

      const generatedImages = await generateImages({
        prompt,
        model,
        aspectRatio: finalAspectRatio,
        resolution: effectiveResolution,
        numberOfImages: finalNumberOfImages,
        signal: abortSignal,
      });

      const imageUrls = await Promise.all(
        generatedImages.map(async (img) => {
          const uploaded = await uploadImage(img.imageBytes, img.mimeType);
          if (uploaded) return uploaded;
          // Fallback to an inline data URL to avoid leaking image bytes through request URLs.
          return `data:${img.mimeType};base64,${img.imageBytes}`;
        }),
      );
      const modelLabel = resolveImageModelLabel(model);

      return {
        imageUrls,
        model,
        modelLabel,
        aspectRatio: finalAspectRatio,
        resolution: effectiveResolution,
        numberOfImages: finalNumberOfImages,
      };
    },
  });
}
