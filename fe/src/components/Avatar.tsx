import { cx } from "./cx";

type AvatarProps = {
  name: string;
  src?: string | null | undefined;
  size?: "sm" | "md" | "lg";
  tone?: "light" | "dark";
  className?: string | undefined;
};

const sizeClasses = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
};

const toneClasses = {
  light: "bg-stone-200 text-stone-600",
  dark: "bg-stone-700 text-stone-200",
};

// The initial stands in for the picture when the learner has no avatar.
export function Avatar({ name, src = null, size = "md", tone = "light", className }: AvatarProps) {
  const classes = cx(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold uppercase",
    sizeClasses[size],
    toneClasses[tone],
    className,
  );

  if (src !== null) {
    return <img className={cx(classes, "object-cover")} src={src} alt="" />;
  }

  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span className={classes} aria-hidden="true">
      {initial}
    </span>
  );
}
