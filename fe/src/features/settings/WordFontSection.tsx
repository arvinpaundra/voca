import { useState } from "react";
import { Select } from "../../components/Select";
import { WordText } from "../../components/WordText";
import { WORD_FONTS, setWordFont, wordFont, type WordFont } from "../../lib/wordFont";
import { SettingsRow } from "./SettingsRow";
import { SettingsSection } from "./SettingsSection";

const LABELS: Record<WordFont, string> = {
  system: "System default",
  sans: "Sans",
  serif: "Serif",
  rounded: "Rounded",
  handwriting: "Handwriting",
};

// The choice stays on this device, so it applies on change: there is no Save.
export function WordFontSection() {
  const [font, setFont] = useState<WordFont>(() => wordFont());

  const choose = (value: string) => {
    const next = WORD_FONTS.find((candidate) => candidate === value);

    if (next === undefined) return;

    setWordFont(next);
    setFont(next);
  };

  return (
    <SettingsSection title="Display">
      <SettingsRow
        label="Word font"
        help="Changes only kanji, kana, hanzi and hangul in your words. Latin letters (including pinyin), numbers and punctuation keep the app font."
      >
        <div>
          <Select
            label="Word font"
            value={font}
            options={WORD_FONTS.map((candidate) => ({ value: candidate, label: LABELS[candidate] }))}
            onChange={choose}
          />

          <p style={{ fontSize: 20, marginTop: 8 }}>
            <WordText text="勉強 · Tシャツを3枚 · belajar" faceLang="ja" />
          </p>
        </div>
      </SettingsRow>
    </SettingsSection>
  );
}
