import type { Word } from "@voca/contract";

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
  return (
    <ul className="preview-list" aria-label="Preview">
      {words.map((word) => (
        <li key={word.slug}>
          <span className="t" lang={termLang} dir="auto">
            {word.term}
          </span>

          <span lang={meaningLang} dir="auto">
            {word.meaning}
          </span>
        </li>
      ))}

      <li className="more">{`Showing ${words.length} of ${total} words`}</li>
    </ul>
  );
}
