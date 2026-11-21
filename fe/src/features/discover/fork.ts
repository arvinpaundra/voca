import { Result } from "effect";
import type { DeckSlug } from "@voca/contract";
import { session } from "../../lib/appSession";
import { queryClient } from "../../lib/queryClient";

export type ForkOutcome = { kind: "forked"; slug: string } | { kind: "gone" } | { kind: "failed" };

const failureTag = (failure: unknown): string | null => {
  if (typeof failure !== "object" || failure === null || !("_tag" in failure)) return null;

  return typeof failure._tag === "string" ? failure._tag : null;
};

/** Copies a public deck into the Learner's decks. A deck that stopped being public answers `gone`. */
export const forkDeck = async (deckSlug: DeckSlug): Promise<ForkOutcome> => {
  const result = await session.call((client) => client.community.fork({ params: { deckSlug } }));

  if (Result.isSuccess(result)) {
    // The Learner's deck list gains the copy.
    void queryClient.invalidateQueries();

    return { kind: "forked", slug: result.success.slug };
  }

  const tag = failureTag(result.failure);

  return tag === "DeckNotPublic" || tag === "NotFound" ? { kind: "gone" } : { kind: "failed" };
};

export const forkMessage = (outcome: ForkOutcome): string | null => {
  if (outcome.kind === "gone") return "This deck is no longer public.";
  if (outcome.kind === "failed") return "Could not fork this deck. Try again.";

  return null;
};
