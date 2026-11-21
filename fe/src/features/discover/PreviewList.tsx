import { useState } from "react";
import type { Word } from "@voca/contract";
import { WordDetailsModal } from "../deck/WordDetailsModal";

// The term opens the word's modal; the button keeps the term's type and colour instead of the browser's.
const termButtonStyle = {
  background: "none",
  border: 0,
  padding: 0,
  color: "inherit",
  font: "inherit",
  textAlign: "start",
  cursor: "pointer",
} as const;

export function PreviewList({
  words,
  total,
  termLang,
  meaningLang,
}: {
  words: readonly Word[];
  total: number;
  termLang: string;
  meaningLang: string;
}) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  // A preview shows the words' content only, so the modal has no Learner's actions or metrics.
  const openedWord = words.find((word) => word.slug === openSlug) ?? null;

  return (
    <>
      <ul className="preview-list" aria-label="Preview">
        {words.map((word) => (
          <li key={word.slug}>
            <span className="t" lang={termLang} dir="auto">
              <button
                type="button"
                aria-label={`Open ${word.term}`}
                style={termButtonStyle}
                onClick={() => setOpenSlug(word.slug)}
              >
                {word.term}
              </button>
            </span>

            <span lang={meaningLang} dir="auto">
              {word.meaning}
            </span>
          </li>
        ))}

        <li className="more">{`Showing ${words.length} of ${total} words`}</li>
      </ul>

      <WordDetailsModal
        word={openedWord}
        termLang={termLang}
        meaningLang={meaningLang}
        onClose={() => setOpenSlug(null)}
      />
    </>
  );
}
