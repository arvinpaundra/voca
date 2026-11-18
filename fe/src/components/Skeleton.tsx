export function Skeleton({ label, rows = 3, className }: { label: string; rows?: number; className?: string | undefined }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className={className} style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skel" style={{ height: 16, width: index === rows - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}
