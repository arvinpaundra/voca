import { describe, expect, test } from "bun:test";
import type { LearnerSettings } from "@voca/contract";
import { changedSettings, draftFrom, parseDraft } from "./settingsModel";

const saved: LearnerSettings = {
  timezone: "Asia/Jakarta",
  dayStartHour: 4,
  desiredRetention: 0.9,
  newPerDay: 20,
  defaultSessionSize: 10,
  defaultMode: "easy",
};

describe("draftFrom and parseDraft", () => {
  test("a draft made from saved settings parses back to the same settings", () => {
    const parsed = parseDraft(draftFrom(saved));

    expect(parsed).toEqual({ ok: true, settings: saved });
  });

  test("the retention percentage is stored as a fraction", () => {
    const parsed = parseDraft({ ...draftFrom(saved), desiredRetention: "85" });

    expect(parsed).toEqual({ ok: true, settings: { ...saved, desiredRetention: 0.85 } });
  });

  test("out-of-range and non-numeric values are reported per field", () => {
    const parsed = parseDraft({
      ...draftFrom(saved),
      dayStartHour: "24",
      desiredRetention: "79",
      newPerDay: "",
    });

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(Object.keys(parsed.errors).sort()).toEqual(["dayStartHour", "desiredRetention", "newPerDay"]);
  });
});

describe("changedSettings", () => {
  test("sends only the fields that changed", () => {
    expect(changedSettings(saved, { ...saved, newPerDay: 30 })).toEqual({ newPerDay: 30 });
  });

  test("sends nothing when nothing changed", () => {
    expect(changedSettings(saved, saved)).toEqual({});
  });
});
