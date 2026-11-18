// The session response carries no deck slug, so where the session started is remembered for this tab.
const KEY = "voca.study.deck";

// Not a deck slug (those are 10 characters), so it never collides with one.
const HARD = "hard";

const remember = (value: string): void => {
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    // Without it the way back is the dashboard, which is still correct.
  }
};

const remembered = (): string | null => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const rememberStudyDeck = (deckSlug: string): void => {
  remember(deckSlug);
};

export const rememberHardStudy = (): void => {
  remember(HARD);
};

export const isHardStudy = (): boolean => remembered() === HARD;

export const studyReturnHref = (): string => {
  const where = remembered();

  if (where === null) return "/app";
  if (where === HARD) return "/app/hard";

  return `/app/decks/${where}`;
};
