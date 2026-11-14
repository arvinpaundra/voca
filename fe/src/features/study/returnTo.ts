// The session response carries no deck slug, so the deck the session started from is remembered for this tab.
const KEY = "voca.study.deck";

export const rememberStudyDeck = (deckSlug: string): void => {
  try {
    sessionStorage.setItem(KEY, deckSlug);
  } catch {
    // Without it the way back is the dashboard, which is still correct.
  }
};

export const studyReturnHref = (): string => {
  let deckSlug: string | null = null;

  try {
    deckSlug = sessionStorage.getItem(KEY);
  } catch {
    deckSlug = null;
  }

  return deckSlug === null ? "/dashboard" : `/decks/${deckSlug}`;
};
