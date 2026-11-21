import { useQuery } from "@tanstack/react-query";
import type { Word, WordDrillStats } from "@voca/contract";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { StatStrip } from "../../components/StatStrip";
import { wordStatsQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { wordHref } from "../word/wordHref";
import { percent, stability } from "../word/wordFormat";

export interface WordDetailsModalProps {
  // The word shown; null keeps the modal closed.
  word: Word | null;
  termLang: string;
  meaningLang: string;
  // Only on the Learner's own deck: the word's metrics, and Edit word, Delete word and Full details.
  // A Community preview leaves it out and shows the word's content only.
  own?: {
    deckSlug: string;
    onEdit: (word: Word) => void;
    onDelete: (word: Word) => void;
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

  const footer =
    own === undefined ? undefined : (
      <>
        <Button variant="secondary" onClick={() => own.onEdit(word)}>
          Edit word
        </Button>
        <Button variant="danger" onClick={() => own.onDelete(word)}>
          Delete word
        </Button>
        <Button variant="ghost" href={wordHref(own.deckSlug, word.slug)}>
          Full details
        </Button>
      </>
    );

  return (
    <Modal open title={word.term} onClose={onClose} footer={footer}>
      <div className="grid gap-3">
        {word.reading !== null && (
          <p lang={termLang} dir="auto">
            {word.reading}
          </p>
        )}

        <p lang={meaningLang} dir="auto">
          {word.meaning}
        </p>

        {example !== null && (
          <dl>
            <dt>Example</dt>
            <dd lang={termLang} dir="auto">
              {example}
            </dd>
          </dl>
        )}

        {notes !== null && (
          <dl>
            <dt>Notes</dt>
            <dd dir="auto">{notes}</dd>
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
        <section key={drill.drill} aria-label={drill.label}>
          <p className="muted">{drill.label}</p>
          <StatStrip
            stats={[
              { label: "recall now", value: percent(drill.recallNow) },
              { label: "stability", value: stability(drill.stabilityDays) },
              { label: "lapses", value: String(drill.lapses) },
              { label: "reviews", value: String(drill.reps) },
              { label: "accuracy", value: percent(drill.accuracy.overall) },
            ]}
          />
        </section>
      ))}
    </>
  );
}
