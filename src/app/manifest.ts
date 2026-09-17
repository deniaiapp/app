import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deni AI",
    short_name: "Deni AI",
    description:
      "Access GPT, Claude, Gemini and more AI models in one place. Free, fast, and private AI chat for everyone.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#171717",
    categories: ["productivity", "utilities"],
    shortcuts: [
      {
        name: "New chat",
        short_name: "Chat",
        description: "Start a new Deni AI chat",
        url: "/chat",
      },
      {
        name: "Settings",
        short_name: "Settings",
        description: "Open Deni AI settings",
        url: "/settings/appearance",
      },
    ],
    icons: [
      {
        src: "/pwa/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/pwa/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
