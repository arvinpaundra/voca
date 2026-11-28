export type PromptSize = "short" | "medium" | "long";

export const promptSize = (text: string): PromptSize | `not implemented: SL ${number}` => `not implemented: SL ${text.length}`;
