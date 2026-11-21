import { useEffect } from "react";
import { AlertCircle, ArrowRight, Check } from "lucide-react";
import { Button } from "../../components/Button";
import { WORD_FONT_CLASS } from "../../lib/wordFont";

// The word's own text gets its own element, so the sentence around it keeps the interface font.
const wordText = (text: string) => <span className={WORD_FONT_CLASS}>{text}</span>;

// The bar under the question once it is answered; it holds the Next button.
export function Verdict({
  correct,
  term,
  answer,
  reading = null,
  readingLang,
  onNext,
}: {
  correct: boolean;
  term: string;
  answer: string;
  // The answered word's reading, shown once the question is answered; null when it has none.
  reading?: string | null;
  readingLang?: string;
  // The deck's term language, for the term in the message.
  termLang?: string | undefined;
  onNext: () => void;
}) {
  // A focused button already turns Enter into a click; handling it here too would advance twice.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat) return;
      if (event.target instanceof HTMLElement && event.target.closest("button, a") !== null) return;

      onNext();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNext]);

  return (
    <div className={correct ? "verdict ok" : "verdict no"} role="status">
      {correct ? <Check className="i" aria-hidden="true" /> : <AlertCircle className="i" aria-hidden="true" />}

      {reading !== null && (
        <span className={`reading ${WORD_FONT_CLASS}`} lang={readingLang}>
          {reading}
        </span>
      )}

      <span className="grow">
        {correct ? (
          <>
            <b>Correct.</b> {wordText(term)} means “{wordText(answer)}”.
          </>
        ) : (
          <>
            <b>Not quite.</b> {wordText(term)} means “{wordText(answer)}”. It comes back later in this session.
          </>
        )}
      </span>

      <Button variant="primary" size="sm" onClick={onNext}>
        Next
        <ArrowRight className="i" aria-hidden="true" />
      </Button>
    </div>
  );
}
