export type PromptSize = "short" | "medium" | "long";

const SHORT_LIMIT = 6;
const MEDIUM_LIMIT = 14;

export const promptSize = (text: string): PromptSize => {
  const length = [...text].length;

  if (length <= SHORT_LIMIT) {
    return "short";
  }

  if (length <= MEDIUM_LIMIT) {
    return "medium";
  }

  return "long";
};
