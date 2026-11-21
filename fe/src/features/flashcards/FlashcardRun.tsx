import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { readingLang, type Word } from "@voca/contract";
import { Button } from "../../components/Button";
import { Term } from "../../components/Term";
import { back, currentCard, flip, startRun, summary, swipe, type Mark, type Run } from "./flashcardsModel";

// A drag this far, and more across than down, is a swipe; a shorter touch is still a tap that flips the card.
const SWIPE_MIN_PX = 48;

const markForKey = (key: string): Mark | null => {
  if (key === "ArrowRight") return "remembered";
  if (key === "ArrowLeft") return "notYet";

  return null;
};

// A run over the given cards: flip, swipe or press the buttons and arrow keys, go back, then the summary.
export function FlashcardRun({ cards, termLang, backHref }: { cards: ReadonlyArray<Word>; termLang: string; backHref: string }) {
  const [run, setRun] = useState<Run>(() => startRun(cards));
  const drag = useRef<{ readonly x: number; readonly y: number } | null>(null);

  // A swipe also ends in a click on the card; this stops that click from flipping the card the swipe just left.
  const swiped = useRef(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mark = markForKey(event.key);

      if (mark === null) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      setRun((previous) => swipe(previous, mark));
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    swiped.current = false;
    drag.current = event.pointerType === "touch" ? { x: event.clientX, y: event.clientY } : null;
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = drag.current;

    drag.current = null;

    if (start === null) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;

    swiped.current = true;
    setRun((previous) => swipe(previous, dx > 0 ? "remembered" : "notYet"));
  };

  const onClick = () => {
    if (swiped.current) {
      swiped.current = false;

      return;
    }

    setRun((previous) => flip(previous));
  };

  const goBack = () => setRun((previous) => back(previous));

  const card = currentCard(run);

  if (card === null) {
    const { remembered, notYet } = summary(run);

    return (
      <section aria-label="Flashcards summary" className="card complete">
        <h1 className="h1">Flashcards complete</h1>

        <div className="strip" style={{ width: "100%", maxWidth: 280, flex: "none" }} aria-hidden="true">
          {run.marks.map((mark, index) => (
            <i key={index} className={mark === "remembered" ? "r" : "w"} />
          ))}
        </div>

        <p>{`${remembered} remembered`}</p>
        <p>{`${notYet} not yet`}</p>

        <div className="flex justify-center gap-2">
          <Button variant="secondary" onClick={goBack} disabled={run.index === 0}>
            Back
          </Button>
          <Button variant="primary" href={backHref}>
            Back to deck
          </Button>
        </div>
      </section>
    );
  }

  const position = run.index + 1;
  const total = run.cards.length;
  const label = `Card ${position} of ${total}: ${card.term}, ${run.flipped ? "tap to turn back" : "tap to flip"}`;

  return (
    <div style={{ display: "grid", gap: 20, width: "100%", maxWidth: 640, margin: "0 auto" }}>
      <p className="num muted" style={{ textAlign: "center", fontSize: 13 }}>
        {`${position} / ${total}`}
      </p>

      <button
        type="button"
        className="prompt"
        aria-label={label}
        style={{ width: "100%", cursor: "pointer", touchAction: "pan-y" }}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {run.flipped ? (
          <>
            <Term
              term={card.term}
              // Term draws a ruby only for a non-empty reading, so an empty one is a plain term.
              reading={card.reading ?? ""}
              lang={termLang}
              readingLang={readingLang(termLang)}
            />

            <p>{card.meaning}</p>

            {card.example !== null && <p lang={termLang}>{card.example}</p>}

            {card.notes !== null && <p className="muted">{card.notes}</p>}
          </>
        ) : (
          <Term term={card.term} lang={termLang} size="lg" />
        )}
      </button>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
        <Button variant="secondary" onClick={goBack} disabled={run.index === 0}>
          Back
        </Button>
        <Button variant="secondary" onClick={() => setRun((previous) => swipe(previous, "notYet"))}>
          Not yet
        </Button>
        <Button variant="primary" onClick={() => setRun((previous) => swipe(previous, "remembered"))}>
          Remembered
        </Button>
      </div>
    </div>
  );
}
