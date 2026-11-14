import { useEffect, useState, type FormEvent } from "react";
import { Result } from "effect";
import type { DeckSummary } from "@voca/contract";
import { Button } from "../../components/Button";
import { Container } from "../../components/Container";
import { session } from "../../lib/appSession";
import styles from "./dashboard.module.css";

type DeckListState =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "loaded"; readonly decks: readonly DeckSummary[] };

async function fetchDecks(): Promise<DeckListState> {
  const result = await session.call((client) => client.library.listDecks());
  return Result.isSuccess(result)
    ? { kind: "loaded", decks: result.success }
    : { kind: "failed" };
}

export function DashboardPage() {
  const [decks, setDecks] = useState<DeckListState>({ kind: "loading" });

  const reloadDecks = async () => {
    setDecks(await fetchDecks());
  };

  useEffect(() => {
    void reloadDecks();
  }, []);

  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.inner}>
          <DeckList state={decks} />
          <NewDeckForm onCreated={reloadDecks} />
        </div>
      </Container>
    </div>
  );
}

function DeckList({ state }: { state: DeckListState }) {
  if (state.kind === "loading") return <p className={styles.body}>Loading your decks…</p>;
  if (state.kind === "failed") return <p className={styles.error}>Could not load your decks.</p>;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Your decks</h2>
      {state.decks.length === 0 && <p className={styles.body}>No decks yet.</p>}
      <ul className={styles.deckList}>
        {state.decks.map((deck) => (
          <li key={deck.slug}>
            <a className={styles.deck} href={`/decks/${deck.slug}`}>
              <span className={styles.deckTitle}>{deck.title}</span>
              <span className={styles.deckMeta}>
                {deck.termLang} → {deck.meaningLang} · {deck.wordCount} words · {deck.dueCount} due
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NewDeckForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [termLang, setTermLang] = useState("");
  const [meaningLang, setMeaningLang] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFailed(false);

    const result = await session.call((client) =>
      client.library.createDeck({
        payload: {
          title: title.trim(),
          termLang: termLang.trim(),
          meaningLang: meaningLang.trim()
        }
      })
    );

    setSaving(false);
    if (Result.isFailure(result)) {
      setFailed(true);
      return;
    }

    setTitle("");
    setTermLang("");
    setMeaningLang("");
    await onCreated();
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>New deck</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <label className={styles.field}>
          Title
          <input
            className={styles.input}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          Term language
          <input
            className={styles.input}
            required
            placeholder="ja"
            value={termLang}
            onChange={(event) => setTermLang(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          Meaning language
          <input
            className={styles.input}
            required
            placeholder="en"
            value={meaningLang}
            onChange={(event) => setMeaningLang(event.target.value)}
          />
        </label>
        {failed && <p className={styles.error}>Could not create the deck. Check the fields and try again.</p>}
        <div>
          <Button variant="primary" type="submit" disabled={saving}>
            Create deck
          </Button>
        </div>
      </form>
    </section>
  );
}
