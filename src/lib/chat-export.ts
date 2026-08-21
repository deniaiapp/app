import type { UIMessage } from "ai";

function getTextFromMessage(message: UIMessage): string {
  const texts: string[] = [];
  for (const part of message.parts) {
    if (part.type === "text") {
      texts.push(part.text);
    }
  }
  return texts.join("\n");
}

export function exportAsMarkdown(messages: UIMessage[], title?: string): string {
  const lines: string[] = [];

  if (title) {
    lines.push(`# ${title}`, "");
  }

  for (const message of messages) {
    const text = getTextFromMessage(message);
    if (!text.trim()) continue;

    if (message.role === "user") {
      lines.push("**User**", "", text, "");
    } else if (message.role === "assistant") {
      lines.push("**Assistant**", "", text, "");
    }
  }

  return lines.join("\n");
}

export function exportAsJson(messages: UIMessage[]): string {
  return JSON.stringify(messages, null, 2);
}

export function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAsPdf(): void {
  window.print();
}
