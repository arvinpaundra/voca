import { DRILLS, type Question } from "@voca/contract";
import { WordText } from "../../components/WordText";
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
        <p className="term" lang={promptLang(question.drill, termLang)}>
          <WordText text={question.prompt.text} faceLang={termLang} />
        </p>
      ) : (
        <p className="term" dir="auto">
          <WordText text={question.prompt.text} faceLang={termLang} />
        </p>
      )}
    </>
  );
}
