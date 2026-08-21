import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export const metadata: Metadata = {
  title: {
    absolute: "Deni AI — Free AI Chat with GPT, Claude & Gemini",
  },
  description: "Free multi-model AI chat with GPT, Claude, Gemini, and more in one place.",
};

export default function RootPage() {
  permanentRedirect("/home");
}
