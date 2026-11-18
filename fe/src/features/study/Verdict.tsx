import { useEffect } from "react";
import { AlertCircle, ArrowRight, Check } from "lucide-react";
import { Button } from "../../components/Button";

// The bar under the question once it is answered; it holds the Next button.
export function Verdict({
  correct,
  term,
  answer,
  onNext,
}: {
  correct: boolean;
  term: string;
  answer: string;
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

      <span className="grow">
        {correct ? (
          <>
            <b>Correct.</b> {term} means “{answer}”.
          </>
        ) : (
          <>
            <b>Not quite.</b> {term} means “{answer}”. It comes back later in this session.
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
