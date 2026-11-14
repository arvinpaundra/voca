import type { Word } from "@voca/contract";

// The word form's text fields. Optional fields stay empty strings until the Learner fills them in.
export interface WordDraft {
  readonly term: string;
  readonly reading: string;
  readonly meaning: string;
  readonly example: string;
  readonly notes: string;
}

export const emptyDraft: WordDraft = { term: "", reading: "", meaning: "", example: "", notes: "" };

export const DUPLICATE_MESSAGE = "This word is already in the deck.";

export const draftFromWord = (word: Word): WordDraft => ({
  term: word.term,
  reading: word.reading ?? "",
  meaning: word.meaning,
  example: word.example ?? "",
  notes: word.notes ?? "",
});

export const isComplete = (draft: WordDraft): boolean =>
  draft.term.trim() !== "" && draft.meaning.trim() !== "";

const trimmedOrNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

// Create: an empty optional field is left out, so no value is stored.
export const createPayload = (draft: WordDraft) => {
  const reading = trimmedOrNull(draft.reading);
  const example = trimmedOrNull(draft.example);
  const notes = trimmedOrNull(draft.notes);

  return {
    term: draft.term.trim(),
    meaning: draft.meaning.trim(),
    ...(reading !== null && { reading }),
    ...(example !== null && { example }),
    ...(notes !== null && { notes }),
  };
};

// Update: an emptied optional field is sent as null, which clears it on the server.
export const updatePayload = (draft: WordDraft) => ({
  term: draft.term.trim(),
  meaning: draft.meaning.trim(),
  reading: trimmedOrNull(draft.reading),
  example: trimmedOrNull(draft.example),
  notes: trimmedOrNull(draft.notes),
});

// The `_tag` of a typed API failure, or undefined for a network or decoding problem.
export const failureTag = (failure: unknown): string | undefined =>
  typeof failure === "object" && failure !== null && "_tag" in failure && typeof failure._tag === "string"
    ? failure._tag
    : undefined;
