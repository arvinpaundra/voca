import type { HTMLAttributes } from "react";
import { cx } from "./cx";

// The design's `.card`: a <section> so an aria-label makes it a named region.
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cx("card", className)} {...props} />;
}
