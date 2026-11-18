import type { DateTime } from "effect";
import type { HardWord } from "@voca/contract";

export function HardWordList(_props: {
  words: readonly HardWord[];
  now: DateTime.Utc;
  onUnmark: (word: HardWord) => void;
}) {
  return <p>not implemented: F-H</p>;
}
