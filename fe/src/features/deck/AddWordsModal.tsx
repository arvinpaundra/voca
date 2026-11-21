import type { Deck, Word, WordLabels } from "@voca/contract";
import { Modal } from "../../components/Modal";

type AddWordsModalProps = {
  deck: Deck;
  labels: WordLabels;
  onClose: () => void;
  onSaved: (words: ReadonlyArray<Word>) => void;
};

export function AddWordsModal({ onClose }: AddWordsModalProps) {
  return (
    <Modal open title="Add words" onClose={onClose}>
      <p>not implemented: LF</p>
    </Modal>
  );
}
