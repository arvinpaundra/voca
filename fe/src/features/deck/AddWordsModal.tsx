import { type ReactNode, useRef, useState } from "react";
import { Result } from "effect";
import { X } from "lucide-react";
import { MAX_BATCH_WORDS, type Deck, type WordLabels } from "@voca/contract";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { session } from "../../lib/appSession";
import { WordForm } from "./WordForm";
import {
  batchPayload,
  DUPLICATE_BATCH_MESSAGE,
  duplicateIndexes,
  emptyDraft,
  problemOf,
  type WordDraft,
} from "./wordModel";

type AddWordsModalProps = {
  deck: Deck;
  labels: WordLabels;
  onClose: () => void;
  onSaved: () => void;
};

// `id` names a row for its lifetime, so removing one row never moves another row's state.
// `problem` is the message shown on the row: a failed check, or a duplicate the server named.
type Row = {
  readonly id: number;
  readonly draft: WordDraft;
  readonly problem: string | null;
};

// What a folded word shows in place of its fields.
function foldSummary(draft: WordDraft): ReactNode {
  if (draft.term !== "" && draft.meaning !== "") return `${draft.term} · ${draft.meaning}`;

  return "not implemented: EB";
}

const SAVE_FAILED = "Could not save the words. Try again.";

// Holds a list of new words, saved together in one request or not at all. Only the open word shows its fields.
export function AddWordsModal({ deck, labels, onClose, onSaved }: AddWordsModalProps) {
  const nextId = useRef(1);
  const [rows, setRows] = useState<ReadonlyArray<Row>>([{ id: 0, draft: emptyDraft, problem: null }]);
  // `null` folds every word, so the list can be saved with no word open.
  const [openId, setOpenId] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = rows.length;

  const addAnother = () => {
    if (count >= MAX_BATCH_WORDS) return;

    const id = nextId.current;
    nextId.current += 1;

    setRows((previous) => [...previous, { id, draft: emptyDraft, problem: null }]);
    setOpenId(id);
  };

  const remove = (id: number) => {
    const index = rows.findIndex((row) => row.id === id);
    const remaining = rows.filter((row) => row.id !== id);

    setRows(remaining);

    // The open word leaves; the word that takes its place in the list opens instead.
    const successor = remaining[Math.min(index, remaining.length - 1)];
    if (id === openId && successor !== undefined) setOpenId(successor.id);
  };

  const changeDraft = (id: number, name: keyof WordDraft, value: string) => {
    setRows((previous) =>
      previous.map((row) =>
        row.id === id ? { ...row, draft: { ...row.draft, [name]: value }, problem: null } : row,
      ),
    );
  };

  const save = async () => {
    setError(null);

    const checked = rows.map((row) => ({ ...row, problem: problemOf(row.draft, labels) }));
    const firstInvalid = checked.find((row) => row.problem !== null);

    if (firstInvalid !== undefined) {
      setRows(checked);
      setOpenId(firstInvalid.id);
      return;
    }

    const [first, ...rest] = rows;
    if (first === undefined) return;

    setBusy(true);
    const result = await session.call((client) =>
      client.library.createWords({
        params: { deckSlug: deck.slug },
        payload: batchPayload(first.draft, rest.map((row) => row.draft)),
      }),
    );
    setBusy(false);

    if (Result.isSuccess(result)) {
      onSaved();
      return;
    }

    const indexes = duplicateIndexes(result.failure);
    if (indexes === null) {
      setError(SAVE_FAILED);
      return;
    }

    const flagged = rows.map((row, index) => ({
      ...row,
      problem: indexes.includes(index) ? DUPLICATE_BATCH_MESSAGE : null,
    }));
    const firstFlagged = flagged.find((row) => row.problem !== null);

    setRows(flagged);
    if (firstFlagged !== undefined) setOpenId(firstFlagged.id);
  };

  const label = count === 1 ? "Add 1 word" : `Add ${count} words`;

  return (
    <Modal
      open
      title="Add words"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button busy={busy} onClick={() => void save()}>
            {label}
          </Button>
        </>
      }
    >
      <div className="add-list">
        {rows.map((row, index) => {
          const position = index + 1;

          return row.id === openId ? (
            <div key={row.id} className="word-item is-open">
              <div className="word-item-head">
                <button
                  type="button"
                  className="word-fold muted"
                  aria-expanded="true"
                  onClick={() => setOpenId(null)}
                >
                  Word {position}
                </button>

                {count > 1 && (
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={`Remove word ${position}`}
                    onClick={() => remove(row.id)}
                  >
                    <X aria-hidden="true" size={16} />
                  </button>
                )}
              </div>

              <WordForm
                labels={labels}
                draft={row.draft}
                onChange={(name, value) => changeDraft(row.id, name, value)}
                onSubmit={() => void save()}
              />

              {row.problem !== null && (
                <p role="alert" className="err">
                  {row.problem}
                </p>
              )}
            </div>
          ) : (
            <div key={row.id} className="word-item">
              <div className="word-item-fold">
                <button type="button" className="word-fold" aria-expanded="false" onClick={() => setOpenId(row.id)}>
                  {foldSummary(row.draft)}
                </button>

                {count > 1 && (
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={`Remove word ${position}`}
                    onClick={() => remove(row.id)}
                  >
                    <X aria-hidden="true" size={16} />
                  </button>
                )}
              </div>

              {row.problem !== null && (
                <p role="alert" className="err">
                  {row.problem}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <Button variant="secondary" size="sm" disabled={count >= MAX_BATCH_WORDS} onClick={addAnother}>
          Add another
        </Button>
      </div>

      {error !== null && (
        <p role="alert" className="err">
          {error}
        </p>
      )}
    </Modal>
  );
}
