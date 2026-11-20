// en-GB short patterns differ between ICU builds ("Thu 19 Nov" against "Thu, 19 Nov"), and CI runs Linux while
// most of us are on macOS. Joining the parts ourselves keeps one reading everywhere, tests included.
// UTC throughout, so a calendar day never shifts with the browser's timezone.
const formatters = {
  day: new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
  dayWithYear: new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }),
};

/** "Thu 19 Nov", or "Thu 19 Nov 2026" with the year, for a "YYYY-MM-DD" date. */
export const dayLabel = (date: string, withYear = false): string => {
  const parts = formatters[withYear ? "dayWithYear" : "day"].formatToParts(new Date(`${date}T00:00:00.000Z`));
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  const fields = withYear
    ? [value("weekday"), value("day"), value("month"), value("year")]
    : [value("weekday"), value("day"), value("month")];

  return fields.join(" ");
};
