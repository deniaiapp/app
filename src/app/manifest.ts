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
    icons: [
      {
        src: "/icon-192x192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512x512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
