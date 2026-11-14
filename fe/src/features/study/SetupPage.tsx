import { useEffect, useState } from "react";
import { Option, Result, Schema } from "effect";
import { DeckSlug, type Drill, type DeckDrill, type SessionSize } from "@voca/contract";
import { Button } from "../../components/Button";
import { Container } from "../../components/Container";
import { Wordmark } from "../../components/Wordmark";
import { session } from "../../lib/appSession";
import { failureTag } from "../deck/wordModel";
import { rememberDrills, rememberedDrills } from "./queue";
import { rememberStudyDeck } from "./returnTo";
import styles from "./study.module.css";

const SESSION_SIZES: readonly SessionSize[] = [7, 10, 15, 20];

const DEFAULT_SIZE: SessionSize = 10;

// The API takes a non-empty drill list; this narrows the Learner's selection to that shape.
const isDrillSet = (drills: readonly Drill[]): drills is [Drill, ...Drill[]] => drills.length > 0;

const startFailure = (tag: string | undefined): string => {
  if (tag === "DeckTooSmall") return "This deck has too few words for that session size. Choose a smaller size.";
  if (tag === "DrillNotAvailable") return "One of the drills is not available in this deck. Pick the drills again.";
  return "Could not start the session. Try again.";
};

type SetupState =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "ready"; readonly drills: readonly DeckDrill[]; readonly defaultSize: SessionSize };

export function StudySetupPage({ deckSlug }: { deckSlug: string }) {
  const [state, setState] = useState<SetupState>({ kind: "loading" });
  const [selected, setSelected] = useState<readonly Drill[]>([]);
  const [size, setSize] = useState<SessionSize>(DEFAULT_SIZE);
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
      session.call((client) => client.me.get())
    ]).then(([drillsResult, learnerResult]) => {
      if (!active) return;
      if (!Result.isSuccess(drillsResult)) {
        setState({ kind: "failed" });
        return;
      }

      const drills = drillsResult.success;
      const defaultSize = Result.isSuccess(learnerResult)
        ? learnerResult.success.settings.defaultSessionSize
        : DEFAULT_SIZE;

      setState({ kind: "ready", drills, defaultSize });
      setSize(defaultSize);
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

    const result = await session.call((client) =>
      client.study.start({
        payload: { scope: { kind: "deck", deckSlug: parsedSlug }, drills: selected, size, mode: "easy" }
      })
    );

    setBusy(false);

    if (Result.isSuccess(result)) {
      rememberDrills(window.localStorage, parsedSlug, selected);
      rememberStudyDeck(parsedSlug);
      window.location.assign("/app/study");
      return;
    }

    setError(startFailure(failureTag(result.failure)));
  };

  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.inner}>
          <Wordmark />
          {state.kind === "loading" && <p className={styles.note}>Loading…</p>}
          {state.kind === "failed" && (
            <p className={styles.error} role="alert">The drills could not be loaded.</p>
          )}
          {state.kind === "ready" && state.drills.length === 0 && (
            <p className={styles.note}>This deck has no words to study yet.</p>
          )}
          {state.kind === "ready" && state.drills.length > 0 && (
            <section className={`${styles.setup} ${styles.card}`}>
              <h1 className={styles.title}>Study this deck</h1>

              <fieldset className={styles.group}>
                <legend className={styles.legend}>Drills</legend>
                {state.drills.map((drill) => (
                  <label key={drill.drill} className={styles.choice}>
                    <input
                      type="checkbox"
                      checked={selected.includes(drill.drill)}
                      onChange={() => toggle(drill.drill)}
                    />
                    <span dir="auto">{`${drill.label} · ${drill.due} due · ${drill.new} new`}</span>
                  </label>
                ))}
              </fieldset>

              <fieldset className={styles.group}>
                <legend className={styles.legend}>Session size</legend>
                <div className={styles.sizes}>
                  {SESSION_SIZES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={option === size ? styles.sizeOn : styles.size}
                      aria-pressed={option === size}
                      onClick={() => setSize(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </fieldset>

              {error !== null && <p className={styles.error} role="alert">{error}</p>}

              <div className={styles.actions}>
                <Button variant="primary" disabled={busy || selected.length === 0} onClick={() => void start()}>
                  Start session
                </Button>
                <Button variant="ghost" href={`/app/decks/${deckSlug}`}>
                  Back to deck
                </Button>
              </div>
            </section>
          )}
        </div>
      </Container>
    </div>
  );
}
