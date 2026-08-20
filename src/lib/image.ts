export const imageModelValues = ["gemini-2.5-flash-image"] as const;

export type ImageModel = (typeof imageModelValues)[number];

export const imageAspectRatios = ["1:1", "9:16", "16:9", "4:3", "3:4"] as const;
export type ImageAspectRatio = (typeof imageAspectRatios)[number];

export const imageResolutions = ["1K", "2K", "4K"] as const;
export type ImageResolution = (typeof imageResolutions)[number];

export function resolveImageModelLabel(model: ImageModel): string {
  switch (model) {
    case "gemini-2.5-flash-image":
      return "Nano Banana";
  }
}

export function supportsImageHighResolution(_model: ImageModel): boolean {
  return false;
}
