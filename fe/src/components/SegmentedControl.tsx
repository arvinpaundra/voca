export type SegmentOption<T extends string> = { value: T; label: string };

export function SegmentedControl<T extends string>(_props: {
  label: string;
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  full?: boolean;
  className?: string | undefined;
}) {
  return <p>not implemented: UI-K2</p>;
}
