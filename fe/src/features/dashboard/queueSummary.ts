import type { DeckStats } from "@voca/contract";
import { dayLabel } from "../../components/dateLabel";

/** "About 12 minutes" for the queue, or null when no pace has been measured yet. */
export const estimateText = (minutes: number | null): string | null => {
  if (minutes === null) return null;

  if (minutes === 0) return "Under a minute";

  return `About ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
};

/** The first of the next 7 study days that has cards falling due, or null when none has. */
export const nextDueDate = (forecast: DeckStats["forecast"]): string | null => {
  const day = forecast.find((entry) => entry.count > 0);

  return day?.date ?? null;
};

/** "Thu 19 Nov" for a "YYYY-MM-DD" date. */
export const nextReviewLabel = (date: string): string => dayLabel(date);
