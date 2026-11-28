import { expect, test } from "bun:test";
import { cjkRuns } from "./wordFont";

const run = (text: string, cjk: boolean) => ({ text, cjk });

test.each([
  ["セールでTシャツを3枚買った。", [run("セールで", true), run("T", false), run("シャツを", true), run("3", false), run("枚買った。", true)]],
  ["Polite form: 買います. Past: 買った.", [run("Polite form: ", false), run("買います", true), run(". Past: ", false), run("買った", true), run(".", false)]],
  ["学习", [run("学习", true)]],
  ["xuéxí", [run("xuéxí", false)]],
  ["我每天学习2个小时。", [run("我每天学习", true), run("2", false), run("个小时。", true)]],
  ["학습 2", [run("학습", true), run(" 2", false)]],
  ["勉強 する", [run("勉強", true), run(" ", false), run("する", true)]],
  ["「コーヒー」、ください", [run("「コーヒー」、ください", true)]],
  ["人々〜", [run("人々〜", true)]],
  ["ｶﾀｶﾅ", [run("ｶﾀｶﾅ", true)]],
  ["Ｔシャツ", [run("Ｔ", false), run("シャツ", true)]],
  ["勉強 · belajar", [run("勉強", true), run(" · belajar", false)]],
  ["مرحبا", [run("مرحبا", false)]],
  ["Saya belajar 2 jam setiap hari.", [run("Saya belajar 2 jam setiap hari.", false)]],
] as const)("%s", (text, runs) => {
  expect(cjkRuns(text)).toEqual(runs);
});

test("an empty text has no runs", () => {
  expect(cjkRuns("")).toEqual([]);
});
