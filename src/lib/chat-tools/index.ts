import { createBrowseTool } from "./browse";
import { createImageTool } from "./image";
import { createSearchTool } from "./search";
import { createVideoTool } from "./video";
import { platformCapabilities } from "@/lib/platform-capabilities.server";
import type { CreateChatToolsOptions } from "./types";

export function createChatTools({
  userId,
  videoMode,
  imageMode,
  webSearch = true,
}: CreateChatToolsOptions) {
  const { features } = platformCapabilities;
  const webSearchEnabled = webSearch && features.webSearch;

  return {
    ...(webSearchEnabled
      ? {
          search: createSearchTool(),
          browse: createBrowseTool(),
        }
      : {}),
    ...(videoMode && features.videoGeneration ? { video: createVideoTool(userId) } : {}),
    ...(imageMode && features.imageGeneration ? { image: createImageTool() } : {}),
  };
}
