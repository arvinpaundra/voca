import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Result } from "effect";
import type { DeckSummary } from "@voca/contract";
import { Button } from "../../components/Button";
import { Container } from "../../components/Container";
import { Wordmark } from "../../components/Wordmark";
import { session } from "../../lib/appSession";
import { DeckModal } from "./DeckModal";
import { filterDecks, termLangsOf, type DeckFilter, type DeckSort } from "./deckList";
import styles from "./decks.module.css";

type DeckListState =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "loaded"; decks: readonly DeckSummary[] };

const sortOptions: readonly { value: DeckSort; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "title", label: "A–Z" },
  { value: "words", label: "Most words" },
  { value: "due", label: "Most due" }
];

const initialFilter: DeckFilter = { q: "", termLang: null, sort: "recent" };

export function DecksPage() {
  const [state, setState] = useState<DeckListState>({ kind: "loading" });
  const [filter, setFilter] = useState<DeckFilter>(initialFilter);
  const [creating, setCreating] = useState(false);

  // The whole list is loaded once; search, the language filter and sorting happen in the browser.
  const loadDecks = useCallback(async () => {
    const result = await session.call((client) => client.library.listDecks());
    setState(Result.isSuccess(result) ? { kind: "loaded", decks: result.success } : { kind: "failed" });
  }, []);

  useEffect(() => {
    void loadDecks();
  }, [loadDecks]);

  const decks = state.kind === "loaded" ? state.decks : [];
  const langs = termLangsOf(decks);
  const visible = filterDecks(decks, filter);

  const changeLang = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFilter((previous) => ({ ...previous, termLang: value === "" ? null : value }));
  };

  const changeSort = (event: ChangeEvent<HTMLSelectElement>) => {
    const sort = event.target.value as DeckSort;
    setFilter((previous) => ({ ...previous, sort }));
  };

  const changeSearch = (event: ChangeEvent<HTMLInputElement>) => {
    const q = event.target.value;
    setFilter((previous) => ({ ...previous, q }));
  };

  const saved = () => {
    setCreating(false);
    void loadDecks();
  };

  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.inner}>
          <Wordmark />

          <header className={styles.header}>
            <div className={styles.headerText}>
              <h1 className={styles.title}>Decks</h1>
              {state.kind === "loaded" && (
                <p className={styles.note}>
                  {decks.length} {decks.length === 1 ? "deck" : "decks"}
                </p>
              )}
            </div>
            <Button variant="primary" onClick={() => setCreating(true)}>
              New deck
            </Button>
          </header>

          {state.kind === "loaded" && decks.length > 0 && (
            <div className={styles.toolbar}>
              <input
                className={styles.input}
                type="search"
                dir="auto"
                aria-label="Search decks"
                placeholder="Search decks"
                value={filter.q}
                onChange={changeSearch}
              />
              <select
                className={styles.select}
                aria-label="Term language"
                value={filter.termLang ?? ""}
                onChange={changeLang}
              >
                <option value="">All languages</option>
                {langs.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              <select className={styles.select} aria-label="Sort" value={filter.sort} onChange={changeSort}>
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {state.kind === "loading" && <p className={styles.note}>Loading decks…</p>}
          {state.kind === "failed" && <p className={styles.error} role="alert">Could not load your decks.</p>}

          {state.kind === "loaded" && decks.length === 0 && (
            <div className={styles.empty}>
              <p className={styles.note}>No decks yet.</p>
              <Button variant="primary" onClick={() => setCreating(true)}>
                New deck
              </Button>
            </div>
          )}

          {state.kind === "loaded" && decks.length > 0 && visible.length === 0 && (
            <p className={styles.note}>No decks match your search.</p>
          )}

          {visible.length > 0 && (
            <ul className={styles.grid}>
              {visible.map((deck) => (
                <li key={deck.slug}>
                  <article className={styles.card}>
                    <a className={styles.cardTitle} href={`/app/decks/${deck.slug}`} dir="auto">
                      {deck.title}
                    </a>
                    <p className={styles.note}>
                      {deck.termLang} → {deck.meaningLang}
                    </p>
                    <p className={styles.note}>
                      {deck.wordCount} words · {deck.dueCount} due
                    </p>
                    <div className={styles.cardActions}>
                      {deck.wordCount > 0 ? (
                        <Button variant="ghost" href={`/app/decks/${deck.slug}/study`}>
                          Study
                        </Button>
                      ) : (
                        <Button variant="ghost" disabled>
                          Study
                        </Button>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>

      <DeckModal open={creating} onClose={() => setCreating(false)} onSaved={saved} />
    </div>
  );
}
