import { useEffect } from "react";
import { Check, X } from "lucide-react";
import { cx } from "../../components/cx";
import { WORD_FONT_CLASS } from "../../lib/wordFont";

export type AnswerOption = { wordSlug: string; text: string };

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
  faceLang?: string | undefined;
  onChoose: (wordSlug: string) => void;
}) {
  const answered = chosenSlug !== null;
  const locked = answered || disabled === true;

  useEffect(() => {
    if (locked) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (!/^[1-4]$/.test(event.key)) return;

      const option = options[Number(event.key) - 1];

      if (option === undefined) return;

      onChoose(option.wordSlug);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, options, onChoose]);

  return (
    <div className="options" role="group" aria-label="Answers">
      {options.map((option, index) => {
        const isRight = answered && option.wordSlug === correctSlug;
        const isWrong = answered && option.wordSlug === chosenSlug && !isRight;

        return (
          <button
            key={option.wordSlug}
            type="button"
            className={cx("opt", isRight && "right", isWrong && "wrong", answered && !isRight && !isWrong && "dim")}
            disabled={locked}
            onClick={() => onChoose(option.wordSlug)}
          >
            <kbd>{index + 1}</kbd>

            <span className={cx("grow", WORD_FONT_CLASS, lang !== undefined && "font-term")} lang={lang} dir="auto">
              {option.text}
            </span>

            {isWrong && <X className="i" aria-hidden="true" />}
            {isRight && <Check className="i" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
