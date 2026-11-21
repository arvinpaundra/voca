import { useState } from "react";
import type { SessionSize } from "@voca/contract";
import { Button } from "../../components/Button";
import { SegmentedControl } from "../../components/SegmentedControl";

type SizeChoice = { readonly value: string; readonly label: string; readonly size: SessionSize | undefined };

// "All" is the whole deck, which the API answers when no size is sent.
const CHOICES: ReadonlyArray<SizeChoice> = [
  { value: "7", label: "7", size: 7 },
  { value: "10", label: "10", size: 10 },
  { value: "15", label: "15", size: 15 },
  { value: "20", label: "20", size: 20 },
  { value: "all", label: "All", size: undefined },
];

const DEFAULT_CHOICE = "10";

// Picks how many cards to go over: 7, 10, 15 or 20, or all of them (undefined).
export function FlashcardSetup({ wordCount, onStart }: { wordCount: number; onStart: (size: SessionSize | undefined) => void }) {
  const [picked, setPicked] = useState(DEFAULT_CHOICE);

  const choice = CHOICES.find((option) => option.value === picked) ?? CHOICES[1]!;

  return (
    <section className="card" aria-label="Flashcards setup" style={{ display: "grid", gap: 24, width: "100%", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <h1 className="h1">Flashcards</h1>
        <p className="muted">{`${wordCount} ${wordCount === 1 ? "word" : "words"} in this deck`}</p>
      </div>

      <div className="field">
        <span className="lbl">Cards</span>

        <SegmentedControl
          full
          label="Cards"
          options={CHOICES.map((option) => ({ value: option.value, label: option.label }))}
          value={choice.value}
          onChange={setPicked}
        />
      </div>

      <div className="form-actions" style={{ alignItems: "center" }}>
        <Button variant="primary" disabled={wordCount === 0} onClick={() => onStart(choice.size)}>
          Start flashcards
        </Button>
      </div>
    </section>
  );
}
