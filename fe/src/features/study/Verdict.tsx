import { useEffect } from "react";
import { AlertCircle, ArrowRight, Check } from "lucide-react";
import { Button } from "../../components/Button";
import { WordText } from "../../components/WordText";

// A word's text takes the word font only when it has a language the word font covers; a meaning has none.
const wordText = (text: string, lang: string | undefined, faceLang: string | undefined) =>
  lang === undefined ? text : <WordText text={text} faceLang={faceLang} />;

// The bar under the question once it is answered; it holds the Next button.
export function Verdict({
  correct,
  term,
  answer,
  reading = null,
  readingLang,
  termLang,
  answerLang,
  faceLang,
  onNext,
}: {
  correct: boolean;
  term: string;
  answer: string;
  // The answered word's reading, shown once the question is answered; null when it has none.
  reading?: string | null;
  readingLang?: string;
  // The language of the term in the message; undefined when it is not word content in a covered language.
  termLang?: string | undefined;
  // The language of the answer when it is a term; undefined for a meaning.
  answerLang?: string | undefined;
  // The deck's term language: the face every CJK character of the term, the answer and the reading takes.
  faceLang?: string | undefined;
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
        <span className="reading" lang={readingLang}>
          <WordText text={reading} faceLang={faceLang} />
        </span>
      )}

      <span className="grow">
        {correct ? (
          <>
            <b>Correct.</b> {wordText(term, termLang, faceLang)} means “{wordText(answer, answerLang, faceLang)}”.
          </>
        ) : (
          <>
            <b>Not quite.</b> {wordText(term, termLang, faceLang)} means “{wordText(answer, answerLang, faceLang)}”. It
            comes back later in this session.
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
