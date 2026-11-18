// The Learner's chosen session size, under the same `voca.` prefix as the other per-device memories.
const KEY = "voca.study.requestedSize";

/**
 * The size the Learner asked for. The session response carries only the words it found, so the setup screen
 * leaves the request behind for the session screen, the way the deck slug is left in returnTo.ts.
 */
export const rememberRequestedSize = (storage: Storage, size: number): void => {
  try {
    storage.setItem(KEY, String(size));
  } catch {
    // Blocked or full storage only loses the notice; the session still starts.
  }
};

export const requestedSize = (storage: Storage): number | null => {
  let raw: string | null;

  try {
    raw = storage.getItem(KEY);
  } catch {
    return null;
  }

  if (raw === null) return null;

  const size = Number(raw);

  return Number.isInteger(size) && size > 0 ? size : null;
};

/** What to tell the Learner when fewer words were found than asked for, or null when the session is full. */
export const shortSessionNotice = (requested: number | null, size: number): string | null => {
  if (requested === null || size >= requested) return null;

  return `Only ${size} of the ${requested} words you asked for were available today.`;
};
