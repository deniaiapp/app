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
  usage,
}: CreateChatToolsOptions) {
  const { features } = platformCapabilities;
  // Video/image modes force a single dedicated tool; keep search/browse out of
  // those exclusive turns so the model cannot pick the wrong one.
  const webSearchEnabled = webSearch && features.webSearch && !videoMode && !imageMode;

  return {
    ...(webSearchEnabled
      ? {
          search: createSearchTool(usage),
          browse: createBrowseTool(),
        }
      : {}),
    ...(videoMode && features.videoGeneration ? { video: createVideoTool(userId) } : {}),
    ...(imageMode && features.imageGeneration ? { image: createImageTool() } : {}),
  };
}
