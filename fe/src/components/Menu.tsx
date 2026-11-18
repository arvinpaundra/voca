export type MenuItem = { label: string; onSelect: () => void; danger?: boolean };

export function Menu(_props: {
  label: string;
  items: ReadonlyArray<MenuItem>;
  className?: string | undefined;
}) {
  return <p>not implemented: UI-K</p>;
}
