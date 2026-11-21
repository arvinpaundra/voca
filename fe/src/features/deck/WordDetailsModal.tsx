import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Word, WordDrillStats } from "@voca/contract";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { StatStrip } from "../../components/StatStrip";
import { wordStatsQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { WORD_FONT_CLASS } from "../../lib/wordFont";
import { wordHref } from "../word/wordHref";
import { percent, stability } from "../word/wordFormat";

export interface WordDetailsModalProps {
  // The word shown; null keeps the modal closed.
  word: Word | null;
  termLang: string;
  meaningLang: string;
  // Only on the Learner's own deck: the word's metrics and Full details.
  // A Community preview leaves it out and shows the word's content only.
  own?: {
    deckSlug: string;
  };
  onClose: () => void;
}

type Metrics = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; drills: readonly WordDrillStats[] };

// Everything about one word, over the list it was opened from, so closing it leaves the page where it was.
export function WordDetailsModal({ word, termLang, meaningLang, own, onClose }: WordDetailsModalProps) {
  // Mounts only while a word is open, so every opening starts with its own metrics request.
  if (word === null) return null;

  return (
    <WordDetailsDialog
      key={word.slug}
      word={word}
      termLang={termLang}
      meaningLang={meaningLang}
      own={own}
      onClose={onClose}
    />
  );
}

type WordDetailsDialogProps = Omit<WordDetailsModalProps, "word" | "own"> & {
  word: Word;
  own?: WordDetailsModalProps["own"] | undefined;
};

function WordDetailsDialog({ word, termLang, meaningLang, own, onClose }: WordDetailsDialogProps) {
  const owned = own !== undefined;

  // A preview has no Learner's card for the word, so it makes no request.
  const stats = useQuery({ ...wordStatsQuery(word.slug), enabled: owned }, queryClient);

  let metrics: Metrics = { kind: "loading" };
  if (stats.isError) metrics = { kind: "failed" };
  else if (stats.data !== undefined) metrics = { kind: "ready", drills: stats.data.drills };

  const example = word.example !== null && word.example !== "" ? word.example : null;
  const notes = word.notes !== null && word.notes !== "" ? word.notes : null;

  // The modal is view only: its one action is the word page.
  const footer =
    own === undefined ? undefined : (
      <Button variant="ghost" href={wordHref(own.deckSlug, word.slug)}>
        Full details
      </Button>
    );

  return (
    <Modal
      open
      title={word.term}
      titleClassName={WORD_FONT_CLASS}
      titleLang={termLang}
      onClose={onClose}
      footer={footer}
    >
      <div className="grid gap-3">
        {word.reading !== null && (
          <p className={WORD_FONT_CLASS} lang={termLang} dir="auto">
            {word.reading}
          </p>
        )}

        <p className={WORD_FONT_CLASS} lang={meaningLang} dir="auto">
          {word.meaning}
        </p>

        {example !== null && (
          <dl>
            <dt>Example</dt>
            <dd className={WORD_FONT_CLASS} lang={termLang} dir="auto">
              {example}
            </dd>
          </dl>
        )}

        {notes !== null && (
          <dl>
            <dt>Notes</dt>
            <dd className={WORD_FONT_CLASS} dir="auto">
              {notes}
            </dd>
          </dl>
        )}

        {own !== undefined && <MetricsPanel metrics={metrics} />}
      </div>
    </Modal>
  );
}

function MetricsPanel({ metrics }: { metrics: Metrics }) {
  if (metrics.kind === "loading") return <p className="muted">Loading the word’s metrics…</p>;

  if (metrics.kind === "failed") return <p className="err">The word’s metrics could not be loaded.</p>;

  return (
    <>
      {metrics.drills.map((drill) => (
        <DirectionSection key={drill.drill} drill={drill} />
      ))}
    </>
  );
}

// One direction's metrics, folded to its label and recall now until opened.
function DirectionSection({ drill }: { drill: WordDrillStats }) {
  const [open, setOpen] = useState(false);

  return (
    <section aria-label={drill.label}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {`${drill.label} · ${percent(drill.recallNow)}`}
      </button>

      {open && <StatStrip stats={directionStats(drill)} />}
    </section>
  );
}

// The five metrics an unfolded direction shows.
const directionStats = (drill: WordDrillStats) => [
  { label: "recall now", value: percent(drill.recallNow) },
  { label: "stability", value: stability(drill.stabilityDays) },
  { label: "lapses", value: String(drill.lapses) },
  { label: "reviews", value: String(drill.reps) },
  { label: "accuracy", value: percent(drill.accuracy.overall) },
];
