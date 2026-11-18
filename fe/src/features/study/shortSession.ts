/**
 * The size the Learner asked for. The session response carries only the words it found, so the setup screen
 * leaves the request behind for the session screen, the way the deck slug is left in returnTo.ts.
 */
export const rememberRequestedSize = (storage: Storage, size: number): void => {
  throw new Error("not implemented: SF");
};

export const requestedSize = (storage: Storage): number | null => {
  throw new Error("not implemented: SF");
};

/** What to tell the Learner when fewer words were found than asked for, or null when the session is full. */
export const shortSessionNotice = (requested: number | null, size: number): string | null => {
  throw new Error("not implemented: SF");
};
