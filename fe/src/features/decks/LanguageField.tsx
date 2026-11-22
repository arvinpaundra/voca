type LanguageFieldProps = {
  label: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
};

// A picker of the offered languages; "Other…" reveals a free-text tag, so any BCP-47 tag stays reachable.
export function LanguageField({ label }: LanguageFieldProps) {
  return <p>{label}: not implemented: LP</p>;
}
