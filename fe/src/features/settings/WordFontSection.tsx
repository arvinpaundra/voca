import { useState } from "react";
import { Select } from "../../components/Select";
import { WORD_FONT_CLASS, WORD_FONTS, setWordFont, wordFont, type WordFont } from "../../lib/wordFont";
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
      <SettingsRow label="Word font" help="The typeface for words, their readings and examples">
        <Select
          label="Word font"
          value={font}
          options={WORD_FONTS.map((candidate) => ({ value: candidate, label: LABELS[candidate] }))}
          onChange={choose}
        />
      </SettingsRow>

      <p className={WORD_FONT_CLASS} style={{ fontSize: 20, marginTop: 12 }}>
        <span lang="ja">勉強</span> · <span lang="id">belajar</span>
      </p>
    </SettingsSection>
  );
}
