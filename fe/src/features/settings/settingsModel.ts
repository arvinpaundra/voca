import type { LearnerSettings, Mode, SessionSize } from "@voca/contract";

// The form keeps every field as typed text, so a half-typed number is shown as it is until it is saved.
export type SettingsDraft = {
  readonly timezone: string;
  readonly dayStartHour: string;
  readonly desiredRetention: string;
  readonly newPerDay: string;
  readonly defaultSessionSize: SessionSize;
  readonly defaultMode: Mode;
};

export type DraftErrors = Partial<Record<"dayStartHour" | "desiredRetention" | "newPerDay", string>>;

export type ParsedDraft =
  | { readonly ok: true; readonly settings: LearnerSettings }
  | { readonly ok: false; readonly errors: DraftErrors };

// Desired retention is shown as a percentage; the contract stores the fraction.
const RETENTION_MIN_PERCENT = 80;
const RETENTION_MAX_PERCENT = 95;
const DAY_START_MAX_HOUR = 23;
const NEW_PER_DAY_MAX = 200;

export const draftFrom = (settings: LearnerSettings): SettingsDraft => {
  return {
    timezone: settings.timezone,
    dayStartHour: String(settings.dayStartHour),
    desiredRetention: String(Math.round(settings.desiredRetention * 100)),
    newPerDay: String(settings.newPerDay),
    defaultSessionSize: settings.defaultSessionSize,
    defaultMode: settings.defaultMode,
  };
};

const wholeNumber = (text: string): number | null => {
  const trimmed = text.trim();

  if (!/^\d+$/.test(trimmed)) return null;

  return Number(trimmed);
};

const inRange = (value: number | null, min: number, max: number): value is number => {
  return value !== null && value >= min && value <= max;
};

export const parseDraft = (draft: SettingsDraft): ParsedDraft => {
  const dayStartHour = wholeNumber(draft.dayStartHour);
  const retentionPercent = wholeNumber(draft.desiredRetention);
  const newPerDay = wholeNumber(draft.newPerDay);
  const errors: DraftErrors = {};

  if (!inRange(dayStartHour, 0, DAY_START_MAX_HOUR)) {
    errors.dayStartHour = `Enter a whole hour from 0 to ${DAY_START_MAX_HOUR}.`;
  }

  if (!inRange(retentionPercent, RETENTION_MIN_PERCENT, RETENTION_MAX_PERCENT)) {
    errors.desiredRetention = `Enter a whole percentage from ${RETENTION_MIN_PERCENT} to ${RETENTION_MAX_PERCENT}.`;
  }

  if (!inRange(newPerDay, 0, NEW_PER_DAY_MAX)) {
    errors.newPerDay = `Enter a whole number from 0 to ${NEW_PER_DAY_MAX}.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    settings: {
      timezone: draft.timezone,
      dayStartHour: dayStartHour as number,
      desiredRetention: (retentionPercent as number) / 100,
      newPerDay: newPerDay as number,
      defaultSessionSize: draft.defaultSessionSize,
      defaultMode: draft.defaultMode,
    },
  };
};

// Only the fields that differ from the saved settings go to the server; an absent key leaves a setting unchanged.
export type SettingsPatch = { -readonly [K in keyof LearnerSettings]?: LearnerSettings[K] };

export const changedSettings = (saved: LearnerSettings, next: LearnerSettings): SettingsPatch => {
  const patch: SettingsPatch = {};

  if (next.timezone !== saved.timezone) patch.timezone = next.timezone;

  if (next.dayStartHour !== saved.dayStartHour) patch.dayStartHour = next.dayStartHour;

  if (next.desiredRetention !== saved.desiredRetention) patch.desiredRetention = next.desiredRetention;

  if (next.newPerDay !== saved.newPerDay) patch.newPerDay = next.newPerDay;

  if (next.defaultSessionSize !== saved.defaultSessionSize) patch.defaultSessionSize = next.defaultSessionSize;

  if (next.defaultMode !== saved.defaultMode) patch.defaultMode = next.defaultMode;

  return patch;
};
