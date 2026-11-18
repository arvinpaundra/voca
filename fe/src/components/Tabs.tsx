export type Tab<T extends string> = { value: T; label: string; count?: number | undefined };

export function Tabs<T extends string>(_props: {
  label: string;
  tabs: ReadonlyArray<Tab<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  return <p>not implemented: UI-K2</p>;
}
