import type { Word } from "@voca/contract";

export interface WordDetailsModalProps {
  // The word shown; null keeps the modal closed.
  word: Word | null;
  termLang: string;
  meaningLang: string;
  // Only on the Learner's own deck: the word's metrics, and Edit word, Delete word and Full details.
  // A Community preview leaves it out and shows the word's content only.
  own?: {
    deckSlug: string;
    onEdit: (word: Word) => void;
    onDelete: (word: Word) => void;
  };
  onClose: () => void;
}

// Everything about one word, over the list it was opened from, so closing it leaves the page where it was.
export function WordDetailsModal(_props: WordDetailsModalProps) {
  return <p hidden>not implemented: WM</p>;
}
