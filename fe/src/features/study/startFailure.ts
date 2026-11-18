/** The message for a session that could not be started, from the error's `_tag`. */
export const startFailure = (tag: string | undefined): string => {
  if (tag === "NothingToStudy") return "Nothing is due in this deck, and no new words are left for today.";
  if (tag === "DeckTooSmall") return "This deck has too few words for that session size. Choose a smaller size.";
  if (tag === "DrillNotAvailable") return "One of the drills is not available in this deck. Pick the drills again.";

  return "Could not start the session. Try again.";
};
