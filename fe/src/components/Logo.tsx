import { cx } from "./cx";

// The Deck logo: a navy card behind a lime card holding a navy "v", optionally followed by the "voca" name.
export function Logo({
  tone = "light",
  withName = true,
  className,
}: {
  tone?: "light" | "dark";
  withName?: boolean;
  className?: string | undefined;
}) {
  const dark = tone === "dark";

  return (
    <svg
      role="img"
      aria-label="Voca"
      viewBox={withName ? "0 0 150 64" : "0 0 64 64"}
      className={cx("h-8 w-auto", className)}
    >
      <rect x="10" y="9" width="36" height="46" rx="8" fill={dark ? "#fff" : "#002f43"} transform="rotate(-12 28 32)" />
      <rect
        x="20"
        y="10"
        width="36"
        height="46"
        rx="8"
        fill="#c1ff72"
        stroke={dark ? "#1c1917" : "#fff"}
        strokeWidth="2"
        transform="rotate(6 38 33)"
      />
      <path
        d="M30 27 L38 43 L46 27"
        fill="none"
        stroke="#002f43"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="rotate(6 38 33)"
      />
      {withName && (
        <text
          x="74"
          y="43"
          fontFamily="Montserrat, sans-serif"
          fontWeight="700"
          fontSize="32"
          letterSpacing="-1.3"
          fill={dark ? "#fff" : "#1c1917"}
        >
          voca
        </text>
      )}
    </svg>
  );
}
