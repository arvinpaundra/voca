import { Option, Schema } from "effect";
import { CreateWord, type DuplicateWords, type Word, type WordLabels } from "@voca/contract";

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

// Leads with "Duplicate" so a flagged word reads the same wherever its message appears.
export const DUPLICATE_BATCH_MESSAGE = "Duplicate: this word is already in the deck.";

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

// The first reason a new word can't be saved, or null. Checked before any request, so a bad word never reaches the server.
export const problemOf = (draft: WordDraft, labels: WordLabels): string | null => {
  if (draft.term.trim() === "") return `${labels.term} is required.`;

  if (draft.meaning.trim() === "") return "Meaning is required.";

  const valid = Option.isSome(Schema.decodeUnknownOption(CreateWord)(createPayload(draft)));

  return valid ? null : "Keep each field within its length limit.";
};

type CreatePayload = ReturnType<typeof createPayload>;

// A batch always holds at least one word, so the request body is a non-empty list.
export const batchPayload = (first: WordDraft, rest: ReadonlyArray<WordDraft>) => {
  const words: [CreatePayload, ...CreatePayload[]] = [
    createPayload(first),
    ...rest.map((draft) => createPayload(draft)),
  ];

  return { words };
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

// The 0-based positions the server names as duplicates, or null when the failure is something else.
export const duplicateIndexes = (failure: unknown): ReadonlyArray<number> | null =>
  failureTag(failure) === "DuplicateWords" ? (failure as DuplicateWords).indexes : null;
