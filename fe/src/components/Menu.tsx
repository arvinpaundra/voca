export type MenuItem = { label: string; onSelect: () => void; danger?: boolean };

// `trigger`: the design's bare icon button in rows, or a bordered secondary button in page headers.
export function Menu(_props: {
  label: string;
  items: ReadonlyArray<MenuItem>;
  trigger?: "icon" | "secondary";
  className?: string | undefined;
}) {
  return <p>not implemented: UI-K2</p>;
}
