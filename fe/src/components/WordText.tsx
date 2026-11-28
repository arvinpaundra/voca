import { Fragment } from "react";
import { WORD_FONT_CLASS, cjkRuns } from "../lib/wordFont";

export function WordText({ text, faceLang }: { text: string; faceLang: string | undefined }) {
  if (faceLang === undefined) return <>{text}</>;

  return (
    <>
      {cjkRuns(text).map((run, index) =>
        run.cjk ? (
          <span key={index} className={WORD_FONT_CLASS} lang={faceLang}>
            {run.text}
          </span>
        ) : (
          <Fragment key={index}>{run.text}</Fragment>
        ),
      )}
    </>
  );
}
