import { useEffect, useState } from "react";
import { Option, Result, Schema } from "effect";
import { DeckSlug, type Drill, type DeckDrill, type Mode, type SessionSize } from "@voca/contract";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ChoiceCard } from "../../components/ChoiceCard";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
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

type SetupState =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "ready"; readonly drills: readonly DeckDrill[]; readonly defaultSize: SessionSize; readonly defaultMode: Mode; readonly deckTitle: string };

export function StudySetupPage({ deckSlug }: { deckSlug: string }) {
  const [state, setState] = useState<SetupState>({ kind: "loading" });
  const [selected, setSelected] = useState<readonly Drill[]>([]);
  const [size, setSize] = useState<SessionSize>(DEFAULT_SIZE);
  const [mode, setMode] = useState<Mode>("easy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A URL segment is a plain string; the API takes a DeckSlug, so a malformed one never leaves the page.
  const parsedSlug = Option.getOrNull(Schema.decodeUnknownOption(DeckSlug)(deckSlug));

  useEffect(() => {
    let active = true;

    if (parsedSlug === null) {
      setState({ kind: "failed" });
      return;
    }

    setState({ kind: "loading" });

    Promise.all([
      session.call((client) => client.study.deckDrills({ params: { deckSlug: parsedSlug } })),
      session.call((client) => client.me.get()),
      session.call((client) => client.library.getDeck({ params: { deckSlug: parsedSlug } }))
    ]).then(([drillsResult, learnerResult, deckResult]) => {
      if (!active) return;
      if (!Result.isSuccess(drillsResult)) {
        setState({ kind: "failed" });
        return;
      }

      const drills = drillsResult.success;
      const defaultSize = Result.isSuccess(learnerResult)
        ? learnerResult.success.settings.defaultSessionSize
        : DEFAULT_SIZE;
      const defaultMode = Result.isSuccess(learnerResult)
        ? learnerResult.success.settings.defaultMode
        : "easy";

      // The title only labels the way back; without it the link says "Deck".
      const deckTitle = Result.isSuccess(deckResult) ? deckResult.success.title : "Deck";

      setState({ kind: "ready", drills, defaultSize, defaultMode, deckTitle });
      setSize(defaultSize);
      setMode(defaultMode);
      setSelected(
        rememberedDrills(window.localStorage, parsedSlug, drills.map((drill) => drill.drill))
      );
    });

    return () => {
      active = false;
    };
  }, [parsedSlug]);

  const toggle = (drill: Drill) => {
    setSelected((previous) =>
      previous.includes(drill) ? previous.filter((item) => item !== drill) : [...previous, drill]
    );
  };

  const start = async () => {
    if (parsedSlug === null || state.kind !== "ready" || !isDrillSet(selected)) return;

    setBusy(true);
    setError(null);

    if (size !== state.defaultSize) {
      // The size is a preference for next time; a failed save must not block the session.
      void session.call((client) => client.me.updateSettings({ payload: { defaultSessionSize: size } }));
    }

    if (mode !== state.defaultMode) {
      // The mode is a preference for next time; a failed save must not block the session.
      void session.call((client) => client.me.updateSettings({ payload: { defaultMode: mode } }));
    }

    const result = await session.call((client) =>
      client.study.start({
        payload: { scope: { kind: "deck", deckSlug: parsedSlug }, drills: selected, size, mode }
      })
    );

    setBusy(false);

    if (Result.isSuccess(result)) {
      rememberDrills(window.localStorage, parsedSlug, selected);
      rememberStudyDeck(parsedSlug);
      rememberRequestedSize(window.localStorage, size);
      window.location.assign("/app/study");
      return;
    }

    setError(startFailure(failureTag(result.failure)));
  };

  return (
    <main className="main">
      <div className="content">
        {state.kind === "loading" && <Skeleton label="Loading drills" rows={3} />}

        {state.kind === "failed" && <ErrorState message="The drills could not be loaded." />}

        {state.kind === "ready" && state.drills.length === 0 && (
          <EmptyState title="This deck has no words to study yet." />
        )}

        {state.kind === "ready" && state.drills.length > 0 && (
          <Card className="mx-auto w-full max-w-[520px]" style={{ gap: 24 }}>
            <div className="ph-text" style={{ display: "grid", gap: 4 }}>
              <a className="back" href={`/app/decks/${deckSlug}`}>
                <ArrowLeft className="i" aria-hidden="true" />
                {state.deckTitle}
              </a>

              <h1 className="h1" style={{ fontSize: "calc(var(--h1) * .85)" }}>
                Study session
              </h1>
            </div>

            <div className="field">
              <span className="lbl">Drills</span>

              <div className="choices">
                {state.drills.map((drill) => (
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

            <div className="field">
              <span className="lbl">Session size</span>

              <SessionSizeField value={size} onChange={setSize} />
            </div>

            <div className="field">
              <span className="lbl">Mode</span>

              <ModeField value={mode} onChange={setMode} />
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
        )}
      </div>
    </main>
  );
}
