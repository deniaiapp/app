"use client";

import { cjk } from "@streamdown/cjk";
import type { MathPlugin, PluginConfig } from "streamdown";
import { useEffect, useMemo, useState } from "react";
import { streamdownCodePlugin } from "@/components/chat/streamdown-code-plugin";
import { lazyMermaid } from "@/components/chat/streamdown-mermaid-plugin";

export const streamdownPlugins: PluginConfig = {
  cjk,
  code: streamdownCodePlugin,
  mermaid: lazyMermaid,
};

const MATH_SYNTAX =
  /(?:\$\$[\s\S]+?\$\$|\$(?!\s)(?:\\.|[^$\n])+\$(?!\w)|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/;

let mathPluginPromise: Promise<MathPlugin> | null = null;

function loadMathPlugin() {
  mathPluginPromise ??= import("@streamdown/math").then(({ math }) => math);
  return mathPluginPromise;
}

export function useStreamdownPlugins(content: string) {
  const hasMath = MATH_SYNTAX.test(content);
  const [math, setMath] = useState<MathPlugin | null>(null);

  useEffect(() => {
    if (!hasMath || math) {
      return;
    }

    let active = true;
    void loadMathPlugin()
      .then((plugin) => {
        if (active) {
          setMath(plugin);
        }
      })
      .catch(() => {
        // Math is an enhancement; Markdown rendering remains usable without it.
      });

    return () => {
      active = false;
    };
  }, [hasMath, math]);

  return useMemo(() => (math ? { ...streamdownPlugins, math } : streamdownPlugins), [math]);
}
