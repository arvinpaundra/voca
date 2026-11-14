import { Option, Schema } from "effect";
import { Drill, type Question } from "@voca/contract";

/** A retried word comes back this many questions after the one answered wrong. */
export const RETRY_GAP = 3;

const DrillList = Schema.Array(Drill);

const storageKey = (deckSlug: string): string => `voca.drills.${deckSlug}`;

/**
 * The pending questions after the head was answered: the head leaves, and a retry (if any) goes
 * RETRY_GAP questions later, or last when fewer questions remain.
 */
export const advance = (queue: readonly Question[], retry: Question | null): Question[] => {
  const rest = queue.slice(1);

  if (retry === null) return rest;

  const at = Math.min(RETRY_GAP - 1, rest.length);

  return [...rest.slice(0, at), retry, ...rest.slice(at)];
};

/** The drills to preselect for a deck: the last set started there, kept to those still available. */
export const rememberedDrills = (storage: Storage, deckSlug: string, available: readonly Drill[]): Drill[] => {
  const fallback = available.slice(0, 1);

  let raw: string | null;

  try {
    raw = storage.getItem(storageKey(deckSlug));
  } catch {
    return fallback;
  }

  if (raw === null) return fallback;

  const remembered = Schema.decodeUnknownOption(DrillList)(parseJson(raw));

  if (Option.isNone(remembered)) return fallback;

  const kept = available.filter((drill) => remembered.value.includes(drill));

  return kept.length > 0 ? kept : fallback;
};

export const rememberDrills = (storage: Storage, deckSlug: string, drills: readonly Drill[]): void => {
  try {
    storage.setItem(storageKey(deckSlug), JSON.stringify(drills));
  } catch {
    // Storage can be full or blocked; the preselection is a convenience, so the session still starts.
  }
};

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
