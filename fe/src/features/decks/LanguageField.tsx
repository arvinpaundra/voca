import { useState } from "react";
import { Input } from "../../components/Input";
import { Select } from "../../components/Select";
import { languageOptions, pickerValue } from "./languages";

// A BCP-47 shape: a primary language subtag, then any number of script, region or variant subtags.
export const languageCodePattern = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
export const languageCodeMessage = "Use a language code like ja or en";

const OTHER = "other";

const pickerOptions = [
  ...languageOptions(),
  { value: OTHER, label: "Other…" },
];

type LanguageFieldProps = {
  label: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
};

// A picker of the offered languages. "Other…" reveals the free-text tag, so any BCP-47 tag stays reachable.
export function LanguageField({ label, value, error, onChange }: LanguageFieldProps) {
  // Stays on "Other…" while the tag is being typed, even when the typed tag matches an offered language.
  const [otherOpen, setOtherOpen] = useState(() => pickerValue(value) === OTHER);

  const choose = (choice: string) => {
    if (choice === OTHER) {
      setOtherOpen(true);
      return;
    }

    setOtherOpen(false);
    onChange(choice);
  };

  return (
    <div className="field">
      <span className="lbl">{label}</span>
      <Select
        label={label}
        value={otherOpen ? OTHER : pickerValue(value)}
        options={pickerOptions}
        onChange={choose}
      />
      {otherOpen && (
        <Input
          label={`${label} code`}
          placeholder="ja"
          value={value}
          error={error ?? undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
