import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DateTime, Option, Result, Schema } from "effect";
import { ArrowLeft, Pencil } from "lucide-react";
import { DeckSlug, WordSlug, wordLabels, type Drill, type WordWithCards } from "@voca/contract";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Menu } from "../../components/Menu";
import { Skeleton } from "../../components/Skeleton";
import { Tabs } from "../../components/Tabs";
import { session } from "../../lib/appSession";
import { deckDrillsQuery, deckQuery, meQuery, wordStatsQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { DeleteWordModal } from "../deck/DeleteWordModal";
import { WordModal } from "../deck/WordModal";
import { DrillPanel } from "./DrillPanel";
import { WordHero } from "./WordHero";
import { wordTabs } from "./wordTabs";

// The word page (FR-6, FR-8): one drill at a time, with the hard toggle per drill.
export function WordPage({ deckSlug, wordSlug }: { deckSlug: string; wordSlug: string }) {
  // URL segments are plain strings; the API takes slugs, so a malformed one never leaves the page.
  const deck = Option.getOrNull(Schema.decodeUnknownOption(DeckSlug)(deckSlug));
  const word = Option.getOrNull(Schema.decodeUnknownOption(WordSlug)(wordSlug));

  if (deck === null || word === null) {
    return (
      <>
        <BackToDeck deckSlug={deckSlug} title="Deck" />
        <ErrorState message="This word could not be loaded." />
      </>
    );
  }

  return <LoadedWord deckSlug={deck} wordSlug={word} />;
}

function LoadedWord({ deckSlug, wordSlug }: { deckSlug: DeckSlug; wordSlug: WordSlug }) {
  const deckResult = useQuery(deckQuery(deckSlug), queryClient);
  const statsResult = useQuery(wordStatsQuery(wordSlug), queryClient);
  const drillsResult = useQuery(deckDrillsQuery(deckSlug), queryClient);
  const meResult = useQuery(meQuery(), queryClient);

  const [selected, setSelected] = useState<Drill | null>(null);
  const [hardBusy, setHardBusy] = useState(false);
  const [hardError, setHardError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deck = deckResult.data;
  const stats = statsResult.data;
  const drills = drillsResult.data;
  const me = meResult.data;

  if (deck === undefined || stats === undefined || drills === undefined || me === undefined) {
    const failed = [deckResult, statsResult, drillsResult, meResult].some((result) => result.isError);

    return (
      <>
        <BackToDeck deckSlug={deckSlug} title="Deck" />
        {failed ? (
          <ErrorState message="This word could not be loaded." onRetry={() => void queryClient.invalidateQueries()} />
        ) : (
          <Skeleton label="Loading word" rows={4} />
        )}
      </>
    );
  }

  const toggleHard = async (drill: Drill, hard: boolean) => {
    setHardBusy(true);
    setHardError(null);

    const result = await session.call((client) =>
      hard
        ? client.study.markHard({ params: { wordSlug, drill } })
        : client.study.unmarkHard({ params: { wordSlug, drill } }),
    );

    setHardBusy(false);
    if (Result.isSuccess(result)) void queryClient.invalidateQueries();
    else setHardError("Could not change the hard mark. Try again.");
  };

  const tabs = wordTabs(drills, stats.drills);
  const current = selected !== null && tabs.some((tab) => tab.value === selected) ? selected : (tabs[0]?.value ?? null);
  const panel = stats.drills.find((entry) => entry.drill === current);

  // The modals work on a word with its cards; the page only edits the word itself.
  const asListed: WordWithCards = { ...stats.word, cards: [] };

  return (
    <>
      <BackToDeck deckSlug={deckSlug} title={deck.title} />

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
          timezone={me.settings.timezone}
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
          void queryClient.invalidateQueries();
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

function BackToDeck({ deckSlug, title }: { deckSlug: string; title: string }) {
  return (
    <a className="back" href={`/app/decks/${deckSlug}`}>
      <ArrowLeft className="i" aria-hidden="true" />
      {title}
    </a>
  );
}
