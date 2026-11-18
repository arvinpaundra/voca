import { useEffect } from "react";
import { cx } from "../../components/cx";

export type AnswerOption = { wordSlug: string; text: string };

const KEYS = ["1", "2", "3", "4"];

// Keys 1-4 choose an option while the question is unanswered.
export function AnswerOptions({
  options,
  correctSlug,
  chosenSlug,
  disabled,
  lang,
  onChoose,
}: {
  options: readonly AnswerOption[];
  correctSlug: string | null;
  chosenSlug: string | null;
  disabled?: boolean;
  lang?: string | undefined;
  onChoose: (wordSlug: string) => void;
}) {
  const answered = correctSlug !== null;
  const locked = answered || disabled === true;

  useEffect(() => {
    if (locked) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const option = options[KEYS.indexOf(event.key)];
      if (option === undefined) return;

      onChoose(option.wordSlug);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [locked, options, onChoose]);

  const correctText = options.find((option) => option.wordSlug === correctSlug)?.text ?? "";

  const cue = (() => {
    if (!answered) return "";
    if (chosenSlug === correctSlug) return "Correct.";
    return `Wrong. The answer is ${correctText}.`;
  })();

  const optionClass = (wordSlug: string) => {
    const base =
      "flex min-h-11 w-full items-center gap-3 rounded-card border bg-white px-4 py-3 text-left text-base font-medium text-stone-900 transition-colors duration-150 disabled:cursor-default";

    if (!answered) return cx(base, "border-stone-200 hover:border-stone-400");
    if (wordSlug === correctSlug) return cx(base, "border-lime bg-lime");
    if (wordSlug === chosenSlug) return cx(base, "border-red-500 bg-red-50 text-red-700");
    return cx(base, "border-stone-200 text-stone-500");
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div role="group" aria-label="Answers" className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option, index) => (
          <button
            key={option.wordSlug}
            type="button"
            className={optionClass(option.wordSlug)}
            disabled={locked}
            onClick={() => onChoose(option.wordSlug)}
          >
            <kbd className="inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] border border-stone-200 font-mono text-[11px] text-stone-500">
              {KEYS[index]}
            </kbd>
            <span dir="auto" lang={lang} className={cx("min-w-0", lang !== undefined && "font-term")}>
              {option.text}
            </span>
          </button>
        ))}
      </div>
      <p role="status" className="min-h-5 text-center text-sm font-medium text-stone-700">
        {cue}
      </p>
    </div>
  );
}
