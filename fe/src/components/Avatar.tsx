import { cx } from "./cx";

const SMALL = { width: 28, height: 28 } as const;

export function Avatar({
  name,
  src,
  size = "md",
  tone = "light",
  className,
}: {
  name: string;
  src?: string | null | undefined;
  size?: "sm" | "md" | "lg";
  tone?: "light" | "dark";
  className?: string | undefined;
}) {
  const initial = name.trim().charAt(0).toUpperCase();
  const classes = cx("avatar", tone === "dark" && "dark", size === "lg" && "lg", className);

  if (src !== undefined && src !== null && src !== "") {
    return (
      <img
        src={src}
        alt=""
        className={classes}
        style={{ objectFit: "cover", ...(size === "sm" ? SMALL : {}) }}
      />
    );
  }

  return (
    <span className={classes} style={size === "sm" ? SMALL : undefined}>
      {initial}
    </span>
  );
}
