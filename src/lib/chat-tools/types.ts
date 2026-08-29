import { z } from "zod";
import { imageAspectRatios, imageModelValues, imageResolutions } from "@/lib/image";
import { veoAspectRatios, veoDurations, veoModelValues, veoResolutions } from "@/lib/veo";

export type SearchResult = {
  title: string;
  url: string;
  description: string;
};

export const VEO_POLL_INTERVAL_MS = 5000;
export const VEO_MAX_POLL_ATTEMPTS = 90;

export const veoToolInputSchema = z.object({
  prompt: z.string().min(1).max(4000).describe("Video prompt"),
  model: z.enum(veoModelValues).optional().describe("Veo model"),
  negativePrompt: z.string().max(2000).optional().describe("Negative prompt"),
  aspectRatio: z.enum(veoAspectRatios).optional().describe("Aspect ratio"),
  resolution: z.enum(veoResolutions).optional().describe("Resolution"),
  durationSeconds: z
    .number()
    .int()
    .refine((value) => veoDurations.some((duration) => duration === value), {
      message: "Invalid duration",
    })
    .optional()
    .describe("Duration in seconds (4, 6, 8)"),
  seed: z.number().int().min(0).max(2_147_483_647).optional().describe("Optional seed"),
});

export const imageToolInputSchema = z.object({
  prompt: z.string().min(1).max(4000).describe("Image prompt"),
  model: z.enum(imageModelValues).optional().describe("Image model"),
  aspectRatio: z.enum(imageAspectRatios).optional().describe("Aspect ratio"),
  resolution: z.enum(imageResolutions).optional().describe("Image resolution (1K, 2K, 4K)"),
  numberOfImages: z.number().int().min(1).max(4).optional().describe("Number of images (1-4)"),
});

export type ChatToolUsageContext = {
  userId: string;
  isAnonymous: boolean;
  onCharged?: (event: { amount: number; maxModeAmount: number }) => void;
  onRefunded?: (event: { amount: number; maxModeRefunded: number }) => void;
};

export type CreateChatToolsOptions = {
  userId?: string;
  videoMode: boolean;
  imageMode: boolean;
  webSearch?: boolean;
  usage?: ChatToolUsageContext;
};
