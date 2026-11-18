import { useId, useRef, useState, type FormEvent } from "react";
import { Result } from "effect";
import type { Deck } from "@voca/contract";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { session } from "../../lib/appSession";
import { failureTag } from "../deck/wordModel";

// Accepts a deck of either list or detail shape: only these fields are read.
type EditableDeck = Pick<Deck, "slug" | "title" | "description" | "termLang" | "meaningLang">;

type DeckModalProps = {
  open: boolean;
  // Set to edit that deck; unset to create a new one.
  deck?: EditableDeck | undefined;
  onClose: () => void;
  onSaved: (deck: Deck) => void;
};

export function DeckModal({ open, deck, onClose, onSaved }: DeckModalProps) {
  // Mounts only while open, so every opening starts from a fresh form.
  if (!open) return null;

  return <DeckEditor deck={deck} onClose={onClose} onSaved={onSaved} />;
}

// A BCP-47 shape: a primary language subtag, then any number of script, region or variant subtags.
const languageCodePattern = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const languageCodeMessage = "Use a language code like ja or en";

type LanguageErrors = { termLang: string | null; meaningLang: string | null };

type DeckEditorProps = {
  deck?: EditableDeck | undefined;
  onClose: () => void;
  onSaved: (deck: Deck) => void;
};

function DeckEditor({ deck, onClose, onSaved }: DeckEditorProps) {
  // The actions live in the dialog footer, outside the form, so Save submits the form through its ref.
  const formRef = useRef<HTMLFormElement>(null);
  const descriptionId = useId();
  const [title, setTitle] = useState(deck?.title ?? "");
  const [description, setDescription] = useState(deck?.description ?? "");
  const [termLang, setTermLang] = useState(deck?.termLang ?? "");
  const [meaningLang, setMeaningLang] = useState(deck?.meaningLang ?? "");
  const [languageErrors, setLanguageErrors] = useState<LanguageErrors>({ termLang: null, meaningLang: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeTermLang = (value: string) => {
    setTermLang(value);
    setLanguageErrors((previous) => ({ ...previous, termLang: null }));
  };

  const changeMeaningLang = (value: string) => {
    setMeaningLang(value);
    setLanguageErrors((previous) => ({ ...previous, meaningLang: null }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextTermLang = termLang.trim();
    const nextMeaningLang = meaningLang.trim();
    const nextLanguageErrors: LanguageErrors = {
      termLang: languageCodePattern.test(nextTermLang) ? null : languageCodeMessage,
      meaningLang: languageCodePattern.test(nextMeaningLang) ? null : languageCodeMessage,
    };

    setLanguageErrors(nextLanguageErrors);
    if (nextLanguageErrors.termLang !== null || nextLanguageErrors.meaningLang !== null) return;

    setBusy(true);
    setError(null);

    const fields = {
      title: title.trim(),
      description: description.trim(),
      meaningLang: nextMeaningLang,
    };

    // The term language is sent only when it changes, so a deck with words can still be renamed.
    const result =
      deck === undefined
        ? await session.call((client) => client.library.createDeck({ payload: { ...fields, termLang: nextTermLang } }))
        : await session.call((client) =>
            client.library.updateDeck({
              params: { deckSlug: deck.slug },
              payload: nextTermLang === deck.termLang ? fields : { ...fields, termLang: nextTermLang },
            }),
          );

    setBusy(false);
    if (Result.isSuccess(result)) {
      onSaved(result.success);
      return;
    }

    setError(
      failureTag(result.failure) === "Forbidden"
        ? "The term language can't change once the deck has words."
        : "Could not save the deck. Try again.",
    );
  };

  return (
    <Modal
      open
      title={deck === undefined ? "New deck" : "Edit deck"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button busy={busy} onClick={() => formRef.current?.requestSubmit()}>
            Save
          </Button>
        </>
      }
    >
      <form ref={formRef} className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <Input label="Title" dir="auto" required value={title} onChange={(event) => setTitle(event.target.value)} />

        <div className="grid gap-1.5">
          <label htmlFor={descriptionId} className="text-xs font-medium text-stone-700">
            Description
          </label>
          <textarea
            id={descriptionId}
            dir="auto"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 hover:border-stone-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          />
        </div>

        <Input
          label="Term language"
          required
          placeholder="ja"
          value={termLang}
          error={languageErrors.termLang ?? undefined}
          onChange={(event) => changeTermLang(event.target.value)}
        />

        <Input
          label="Meaning language"
          required
          placeholder="en"
          value={meaningLang}
          error={languageErrors.meaningLang ?? undefined}
          onChange={(event) => changeMeaningLang(event.target.value)}
        />

        {error !== null && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
