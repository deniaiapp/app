import { tool } from "ai";
import { z } from "zod";

const questionnaireChoiceSchema = z.object({
  value: z.string().min(1).max(120).describe("Stable value returned for this choice"),
  label: z.string().min(1).max(160).describe("Text shown to the user"),
  description: z.string().max(300).optional().describe("Optional supporting detail"),
});

const questionnaireItemSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z][A-Za-z0-9_-]*$/)
    .describe("Unique answer key using letters, numbers, underscores, or hyphens"),
  prompt: z.string().min(1).max(240).describe("The question shown to the user"),
  description: z.string().max(400).optional().describe("Optional context for the question"),
  required: z.boolean().optional().describe("Whether the user must provide an answer"),
  multiple: z.boolean().optional().describe("Allow selecting multiple fixed choices"),
  choices: z.array(questionnaireChoiceSchema).max(8).optional(),
  input: z
    .object({
      label: z.string().min(1).max(120).describe("Accessible label for a free-text answer"),
      placeholder: z.string().max(160).optional(),
    })
    .optional()
    .describe("Optional free-text answer in addition to or instead of choices"),
});

export const questionnaireToolInputSchema = z.object({
  title: z.string().min(1).max(120).describe("Short heading for the questionnaire"),
  description: z.string().max(400).optional().describe("Optional introduction"),
  questions: z
    .array(questionnaireItemSchema)
    .min(1)
    .max(8)
    .describe("A short sequence of questions, shown one at a time"),
});

export type QuestionnaireToolInput = z.infer<typeof questionnaireToolInputSchema>;
export type QuestionnaireToolAnswer =
  | { name: string; status: "answered"; value: string | string[] }
  | { name: string; status: "skipped" };
export type QuestionnaireToolOutput =
  | {
      status: "submitted";
      title: string;
      answers: QuestionnaireToolAnswer[];
    }
  | {
      status: "unavailable";
      reason: string;
    };

export function createQuestionnaireTool() {
  return tool({
    description:
      "Ask the user a short, structured questionnaire when multiple clarifications or selectable options are more useful than a prose question. Use concise prompts, include only necessary questions, and mark questions optional when the user may intentionally skip them. Fixed choices can be single-select or multi-select, and you can add a free-text answer. The questionnaire pauses for the user's input; after it is submitted, continue using the returned answers and respect skipped answers as intentionally unanswered.",
    inputSchema: questionnaireToolInputSchema,
  });
}
