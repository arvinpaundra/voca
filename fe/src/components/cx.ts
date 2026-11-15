// Joins the classes that are set. Pages use it instead of a class-merging library.
export const cx = (...classes: (string | false | null | undefined)[]): string => {
  return classes.filter(Boolean).join(" ");
};
