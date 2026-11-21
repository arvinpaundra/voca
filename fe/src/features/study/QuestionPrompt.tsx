import { DRILLS, type Question } from "@voca/contract";
import { WORD_FONT_CLASS } from "../../lib/wordFont";
import { promptLang } from "./scriptLang";

// The question above the options: its direction label and its prompt, without the word's reading as a hint.
export function QuestionPrompt({ question, termLang }: { question: Question; termLang: string }) {
  // The prompt is the term or the reading in its own script; a meaning has no language in the payload.
  const promptIsTerm = DRILLS[question.drill].prompt !== "meaning";

  // The payload's ruby is ignored: showing the reading above the options would give the answer away.
  return (
    <>
      <span className="drill" dir="auto">{question.drillLabel}</span>

      {promptIsTerm ? (
        <p className={`term ${WORD_FONT_CLASS}`} lang={promptLang(question.drill, termLang)}>
          {question.prompt.text}
        </p>
      ) : (
        <p className={`term ${WORD_FONT_CLASS}`} dir="auto">{question.prompt.text}</p>
      )}
    </>
  );
}
