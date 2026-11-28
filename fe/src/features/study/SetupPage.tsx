import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Option, Result, Schema } from "effect";
import { DeckSlug, type Drill, type DeckDrill, type DeckSetup, type Mode, type SessionSize } from "@voca/contract";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ChoiceCard } from "../../components/ChoiceCard";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { deckQuery, deckSetupQuery, meQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { failureTag } from "../deck/wordModel";
import { startFailure } from "./startFailure";
import { rememberDrills, rememberedDrills } from "./queue";
import { rememberStudyDeck } from "./returnTo";
import { rememberRequestedSize } from "./shortSession";
import { ModeField } from "./ModeField";
import { SessionSizeField } from "./SessionSizeField";

const DEFAULT_SIZE: SessionSize = 10;

// The API takes a non-empty drill list; this narrows the Learner's selection to that shape.
const isDrillSet = (drills: readonly Drill[]): drills is [Drill, ...Drill[]] => drills.length > 0;

// A write changes what the cache holds, so the whole cache refetches once one lands.
const refreshOnSuccess = (result: Result.Result<unknown, unknown>): void => {
  if (Result.isSuccess(result)) void queryClient.invalidateQueries();
};

function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="main">
      <div className="content">{children}</div>
    </main>
  );
}

export function StudySetupPage({ deckSlug }: { deckSlug: string }) {
  // A URL segment is a plain string; the API takes a DeckSlug, so a malformed one never leaves the page.
  const parsedSlug = Option.getOrNull(Schema.decodeUnknownOption(DeckSlug)(deckSlug));

  if (parsedSlug === null) {
    return (
      <Frame>
        <ErrorState message="The drills could not be loaded." />
      </Frame>
    );
  }

  return <SetupPage deckSlug={parsedSlug} />;
}

function SetupPage({ deckSlug }: { deckSlug: DeckSlug }) {
  const setup = useQuery(deckSetupQuery(deckSlug), queryClient);
  const learner = useQuery(meQuery(), queryClient);
  const deck = useQuery(deckQuery(deckSlug), queryClient);

  if (setup.isError) {
    return (
      <Frame>
        <ErrorState message="The drills could not be loaded." />
      </Frame>
    );
  }

  if (!setup.isSuccess || learner.isPending || deck.isPending) {
    return (
      <Frame>
        <Skeleton label="Loading drills" rows={3} />
      </Frame>
    );
  }

  if (setup.data.drills.length === 0) {
    return (
      <Frame>
        <EmptyState title="This deck has no words to study yet." />
      </Frame>
    );
  }

  return (
    <StudyForm
      deckSlug={deckSlug}
      drills={setup.data.drills}
      newCards={setup.data.newCards}
      defaultSize={learner.data?.settings.defaultSessionSize ?? DEFAULT_SIZE}
      defaultMode={learner.data?.settings.defaultMode ?? "easy"}
      // The title only labels the way back; without it the link says "Deck".
      deckTitle={deck.data?.title ?? "Deck"}
    />
  );
}

type StudyFormProps = {
  readonly deckSlug: DeckSlug;
  readonly drills: readonly DeckDrill[];
  readonly newCards: DeckSetup["newCards"];
  readonly defaultSize: SessionSize;
  readonly defaultMode: Mode;
  readonly deckTitle: string;
};

function StudyForm({ deckSlug, drills, newCards, defaultSize, defaultMode, deckTitle }: StudyFormProps) {
  const [selected, setSelected] = useState<readonly Drill[]>(() =>
    rememberedDrills(window.localStorage, deckSlug, drills.map((drill) => drill.drill))
  );

  // Until the Learner picks a value, the form shows the saved default.
  const [chosenSize, setChosenSize] = useState<SessionSize | null>(null);
  const [chosenMode, setChosenMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const size = chosenSize ?? defaultSize;
  const mode = chosenMode ?? defaultMode;

  const toggle = (drill: Drill) => {
    setSelected((previous) =>
      previous.includes(drill) ? previous.filter((item) => item !== drill) : [...previous, drill]
    );
  };

  const start = async () => {
    if (!isDrillSet(selected)) return;

    setBusy(true);
    setError(null);

    if (size !== defaultSize) {
      // The size is a preference for next time; a failed save must not block the session.
      void session
        .call((client) => client.me.updateSettings({ payload: { defaultSessionSize: size } }))
        .then(refreshOnSuccess);
    }

    if (mode !== defaultMode) {
      // The mode is a preference for next time; a failed save must not block the session.
      void session
        .call((client) => client.me.updateSettings({ payload: { defaultMode: mode } }))
        .then(refreshOnSuccess);
    }

    const result = await session.call((client) =>
      client.study.start({
        payload: { scope: { kind: "deck", deckSlug }, drills: selected, size, mode }
      })
    );

    setBusy(false);
    refreshOnSuccess(result);

    if (Result.isSuccess(result)) {
      rememberDrills(window.localStorage, deckSlug, selected);
      rememberStudyDeck(deckSlug);
      rememberRequestedSize(window.localStorage, size);
      window.location.assign("/app/study");
      return;
    }

    setError(startFailure(failureTag(result.failure)));
  };

  return (
    <Frame>
      <Card className="mx-auto w-full max-w-[520px]" style={{ gap: 24 }}>
        <div className="ph-text" style={{ display: "grid", gap: 4 }}>
          <a className="back" href={`/app/decks/${deckSlug}`}>
            <ArrowLeft className="i" aria-hidden="true" />
            {deckTitle}
          </a>

          <h1 className="h1" style={{ fontSize: "calc(var(--h1) * .85)" }}>
            Study session
          </h1>
        </div>

        <div className="field">
          <span className="lbl">Drills</span>

          <div className="choices">
            {drills.map((drill) => (
              <ChoiceCard
                key={drill.drill}
                label={drill.label}
                meta={`${drill.due} due · ${drill.new} new`}
                checked={selected.includes(drill.drill)}
                onChange={() => toggle(drill.drill)}
              />
            ))}
          </div>
        </div>

        <p className="target">
          New cards today: <b>{newCards.studied} of {newCards.target}</b>
          {newCards.studied >= newCards.target && (
            <>
              {" · "}
              <span className="done">
                <Check className="i" aria-hidden="true" />
                target reached
              </span>
            </>
          )}
        </p>

        <div className="field">
          <span className="lbl">Session size</span>

          <SessionSizeField value={size} onChange={setChosenSize} />
        </div>

        <div className="field">
          <span className="lbl">Mode</span>

          <ModeField value={mode} onChange={setChosenMode} />
        </div>

        {error !== null && <p role="alert" style={{ color: "var(--bad)", fontSize: 13 }}>{error}</p>}

        <div className="form-actions" style={{ alignItems: "center" }}>
          <Button
            variant="primary"
            busy={busy}
            disabled={selected.length === 0}
            onClick={() => void start()}
          >
            Start session
            <ArrowRight className="i" aria-hidden="true" />
          </Button>
        </div>
      </Card>
    </Frame>
  );
}
