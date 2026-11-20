import { useCallback, useEffect, useState } from "react";
import { DateTime, Option, Result, Schema } from "effect";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  DeckSlug,
  WordSlug,
  wordLabels,
  type DeckDetail,
  type DeckDrill,
  type Drill,
  type WordStats,
  type WordWithCards,
} from "@voca/contract";
import { Button } from "../../components/Button";
import { useAppData } from "../../components/appData";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Menu } from "../../components/Menu";
import { Skeleton } from "../../components/Skeleton";
import { Tabs } from "../../components/Tabs";
import { session } from "../../lib/appSession";
import { DeleteWordModal } from "../deck/DeleteWordModal";
import { WordModal } from "../deck/WordModal";
import { DrillPanel } from "./DrillPanel";
import { WordHero } from "./WordHero";
import { wordTabs } from "./wordTabs";

type Loaded = {
  deck: DeckDetail;
  stats: WordStats;
  drills: readonly DeckDrill[];
};

type State = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; data: Loaded };

// The word page (FR-6, FR-8): one drill at a time, with the hard toggle per drill.
export function WordPage({ deckSlug, wordSlug }: { deckSlug: string; wordSlug: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<Drill | null>(null);
  const [hardBusy, setHardBusy] = useState(false);
  const [hardError, setHardError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { learner } = useAppData();

  useEffect(() => {
    let active = true;

    // URL segments are plain strings; the API takes slugs, so a malformed one never leaves the page.
    const deck = Schema.decodeUnknownOption(DeckSlug)(deckSlug);
    const word = Schema.decodeUnknownOption(WordSlug)(wordSlug);
    if (Option.isNone(deck) || Option.isNone(word)) {
      setState({ kind: "failed" });
      return;
    }

    Promise.all([
      session.call((client) => client.library.getDeck({ params: { deckSlug: deck.value } })),
      session.call((client) => client.insight.wordStats({ params: { wordSlug: word.value } })),
      session.call((client) => client.study.deckDrills({ params: { deckSlug: deck.value } })),
    ]).then(([deckResult, statsResult, drillsResult]) => {
      if (!active) return;

      if (Result.isSuccess(deckResult) && Result.isSuccess(statsResult) && Result.isSuccess(drillsResult)) {
        setState({
          kind: "ready",
          data: {
            deck: deckResult.success,
            stats: statsResult.success,
            drills: drillsResult.success,
          },
        });
      } else {
        setState({ kind: "failed" });
      }
    });

    return () => {
      active = false;
    };
  }, [deckSlug, wordSlug, reloadKey]);

  const toggleHard = useCallback(
    async (drill: Drill, hard: boolean) => {
      const word = Option.getOrNull(Schema.decodeUnknownOption(WordSlug)(wordSlug));
      if (word === null) return;

      setHardBusy(true);
      setHardError(null);

      const result = await session.call((client) =>
        hard
          ? client.study.markHard({ params: { wordSlug: word, drill } })
          : client.study.unmarkHard({ params: { wordSlug: word, drill } }),
      );

      setHardBusy(false);
      if (Result.isSuccess(result)) setReloadKey((key) => key + 1);
      else setHardError("Could not change the hard mark. Try again.");
    },
    [wordSlug],
  );

  const back = (
    <a className="back" href={`/app/decks/${deckSlug}`}>
      <ArrowLeft className="i" aria-hidden="true" />
      {state.kind === "ready" ? state.data.deck.title : "Deck"}
    </a>
  );

  if (state.kind === "loading" || learner.kind === "loading") {
    return (
      <>
        {back}
        <Skeleton label="Loading word" rows={4} />
      </>
    );
  }

  if (state.kind === "failed" || learner.kind === "failed") {
    return (
      <>
        {back}
        <ErrorState message="This word could not be loaded." onRetry={() => setReloadKey((key) => key + 1)} />
      </>
    );
  }

  const { deck, stats, drills } = state.data;
  const { timezone } = learner.value.settings;
  const tabs = wordTabs(drills, stats.drills);
  const current = selected !== null && tabs.some((tab) => tab.value === selected) ? selected : (tabs[0]?.value ?? null);
  const panel = stats.drills.find((entry) => entry.drill === current);

  // The modals work on a word with its cards; the page only edits the word itself.
  const asListed: WordWithCards = { ...stats.word, cards: [] };

  return (
    <>
      {back}

      <div className="page-head">
        <WordHero word={stats.word} termLang={deck.termLang} meaningLang={deck.meaningLang} />

        <div className="ph-actions">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="i" aria-hidden="true" />
            Edit word
          </Button>

          <Menu
            trigger="secondary"
            label="More actions"
            items={[{ label: "Delete word", danger: true, onSelect: () => setDeleting(true) }]}
          />
        </div>
      </div>

      {hardError !== null && <ErrorState message={hardError} />}

      {current !== null && <Tabs label="Drills" tabs={tabs} value={current} onChange={setSelected} />}

      {current !== null && panel !== undefined && (
        <DrillPanel
          key={panel.drill}
          stats={panel}
          timezone={timezone}
          now={DateTime.nowUnsafe()}
          busy={hardBusy}
          termLang={deck.termLang}
          onToggleHard={(hard) => void toggleHard(panel.drill, hard)}
        />
      )}

      {current !== null && panel === undefined && (
        <EmptyState title="Not studied yet" body="This word has no card in this drill until it comes up in a session." />
      )}

      <WordModal
        open={editing}
        deck={deck}
        labels={wordLabels(deck.termLang)}
        word={asListed}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          setReloadKey((key) => key + 1);
        }}
      />

      <DeleteWordModal
        word={deleting ? asListed : null}
        onClose={() => setDeleting(false)}
        onDeleted={() => window.location.assign(`/app/decks/${deckSlug}`)}
      />
    </>
  );
}
