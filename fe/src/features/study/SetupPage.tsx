import { useEffect, useState } from "react";
import { Option, Result, Schema } from "effect";
import { DeckSlug, type Drill, type DeckDrill, type SessionSize } from "@voca/contract";
import { Button } from "../../components/Button";
import { cx } from "../../components/cx";
import { session } from "../../lib/appSession";
import { failureTag } from "../deck/wordModel";
import { rememberDrills, rememberedDrills } from "./queue";
import { rememberStudyDeck } from "./returnTo";

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
    <div className="min-h-screen bg-neutral-100 px-4 py-6 lg:px-8 lg:py-10">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
        {state.kind === "loading" && <p className="text-sm text-stone-500">Loading…</p>}
        {state.kind === "failed" && (
          <p className="text-sm text-red-600" role="alert">The drills could not be loaded.</p>
        )}
        {state.kind === "ready" && state.drills.length === 0 && (
          <p className="text-sm text-stone-500">This deck has no words to study yet.</p>
        )}
        {state.kind === "ready" && state.drills.length > 0 && (
          <section className="mx-auto flex w-full max-w-xl flex-col gap-7 rounded-card border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="font-montserrat text-2xl font-bold text-stone-900">Study this deck</h1>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-sm font-semibold text-stone-900">Drills</legend>
              {state.drills.map((drill) => {
                const checked = selected.includes(drill.drill);

                return (
                  <label
                    key={drill.drill}
                    className={cx(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors duration-150",
                      checked ? "border-lime bg-lime/15" : "border-stone-200 bg-white hover:border-stone-400",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-lime"
                      checked={checked}
                      onChange={() => toggle(drill.drill)}
                    />
                    <span dir="auto" className="min-w-0 flex-1 text-sm font-medium text-stone-900">
                      {drill.label}
                    </span>
                    <span className="shrink-0 text-xs text-stone-500">{`${drill.due} due · ${drill.new} new`}</span>
                  </label>
                );
              })}
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-sm font-semibold text-stone-900">Session size</legend>
              <div className="grid grid-cols-4 gap-2">
                {SESSION_SIZES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={option === size}
                    onClick={() => setSize(option)}
                    className={cx(
                      "rounded-2xl border py-3 text-base font-semibold transition-colors duration-150",
                      option === size
                        ? "border-lime bg-lime text-stone-900"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-400",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>

            {error !== null && <p className="text-sm text-red-600" role="alert">{error}</p>}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="ghost" href={`/app/decks/${deckSlug}`}>
                Back to deck
              </Button>
              <Button variant="primary" disabled={busy || selected.length === 0} onClick={() => void start()}>
                Start session
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
