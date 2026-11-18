export type Tab<T extends string> = { value: T; label: string; count?: number | undefined };

export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: ReadonlyArray<Tab<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined && (
            <>
              {" "}
              <span className="c">{tab.count}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
