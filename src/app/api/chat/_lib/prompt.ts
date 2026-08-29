type BuildSystemPromptParams = {
  currentDate: string;
  persistentMemory: string | null;
  projectPrompt: string | null;
  additionalInstruction?: string;
  responseStyle?: "retry" | "detailed" | "concise";
  webSearchEnabled?: boolean;
  deepResearch?: boolean;
  forceWebSearch?: boolean;
  videoMode?: boolean;
  imageMode?: boolean;
};

export function buildChatSystemPrompt({
  currentDate,
  persistentMemory,
  projectPrompt,
  additionalInstruction,
  responseStyle = "retry",
  webSearchEnabled = false,
  deepResearch = false,
  forceWebSearch = false,
  videoMode = false,
  imageMode = false,
}: BuildSystemPromptParams): string {
  const responseStyleInstruction =
    responseStyle === "detailed"
      ? "The user asked to regenerate the previous answer with more detail. Keep the same intent, but expand the explanation, include more useful specifics, and improve completeness."
      : responseStyle === "concise"
        ? "The user asked to regenerate the previous answer more concisely. Keep the same intent, but shorten the response, reduce repetition, and prioritize the most important points."
        : "The user asked for a fresh retry of the previous answer. Preserve the intent, but vary the phrasing and structure while keeping the response accurate and useful.";
  const forceWebSearchInstruction =
    forceWebSearch && !videoMode && !imageMode
      ? "Web search is required for this response. Use the search tool at least once before answering, then cite the sources you used. Use the browse tool when a specific page needs a full read."
      : null;
  const researchInstruction =
    deepResearch && !videoMode && !imageMode
      ? [
          "Deep research mode is enabled.",
          "Use the search tool multiple times when helpful.",
          "Use the browse tool to open important URLs and read their full page content when snippets are insufficient.",
          "Cross-check claims before concluding.",
          "Return a structured report with: Summary, Key Findings, Risks or Unknowns, and Sources.",
        ].join(" ")
      : null;
  const additionalInstructionPrompt = additionalInstruction
    ? `Additional regeneration instruction from the user: ${additionalInstruction}`
    : null;
  const webSearchInstructions = webSearchEnabled
    ? [
        "- Use the search tool when you need current information or when the user asks about recent events.",
        "- Use the browse tool to open a specific URL and read its full page content (for example when the user shares a link, or when search snippets are not enough).",
        "- Always cite sources when using information from search or browse results.",
      ]
    : [];

  const videoSystemPromptParts = [
    "You are a helpful AI assistant.",
    `Current date: ${currentDate}.`,
    persistentMemory,
    projectPrompt,
    additionalInstructionPrompt,
    "Video mode is enabled. Always call the `video` tool exactly once using the user's message as the prompt.",
    "Do not call other tools. After the tool returns, provide a short caption for the video.",
  ].filter((value): value is string => value != null);

  const defaultSystemPromptParts = [
    "You are a helpful AI assistant.",
    `Current date: ${currentDate}.`,
    persistentMemory,
    projectPrompt,
    "Guidelines:",
    "- Provide accurate, helpful, and concise responses.",
    ...webSearchInstructions,
    "- If you're unsure about something, acknowledge the uncertainty rather than making up information.",
    "- Format code blocks with appropriate syntax highlighting.",
    "- Use markdown formatting for better readability.",
    additionalInstructionPrompt,
    responseStyleInstruction,
    researchInstruction,
    forceWebSearchInstruction,
  ].filter((value): value is string => value != null);

  return videoMode ? videoSystemPromptParts.join(" ") : defaultSystemPromptParts.join(" ");
}
