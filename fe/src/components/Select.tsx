export type SelectOption = { value: string; label: string };

export function Select(_props: {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  className?: string | undefined;
}) {
  return <p>not implemented: UI-K2</p>;
}
