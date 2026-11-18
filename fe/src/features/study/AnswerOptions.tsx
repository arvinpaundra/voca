export type AnswerOption = { wordSlug: string; text: string };

// Keys 1-4 choose an option while the question is unanswered.
export function AnswerOptions(_props: {
  options: readonly AnswerOption[];
  correctSlug: string | null;
  chosenSlug: string | null;
  disabled?: boolean;
  lang?: string | undefined;
  onChoose: (wordSlug: string) => void;
}) {
  return <p>not implemented: UI-S2</p>;
}
