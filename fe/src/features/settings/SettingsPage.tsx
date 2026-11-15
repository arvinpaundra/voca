import { useEffect, useState, type FormEvent } from "react";
import { Result } from "effect";
import type { Learner, LearnerSettings, Mode, SessionSize } from "@voca/contract";
import { Settings as SettingsIcon, SlidersHorizontal, User } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { cx } from "../../components/cx";
import { session } from "../../lib/appSession";
import { changedSettings, draftFrom, parseDraft, type DraftErrors, type SettingsDraft } from "./settingsModel";

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "loaded"; readonly learner: Learner };

type Notice = { readonly kind: "saved" } | { readonly kind: "failed" } | null;

const SESSION_SIZES: readonly SessionSize[] = [7, 10, 15, 20];

const MODES: readonly { readonly value: Mode; readonly label: string; readonly hint: string }[] = [
  { value: "easy", label: "Easy", hint: "Recognise the answer" },
  { value: "hard", label: "Hard", hint: "Recall it from memory" },
];

const timeZones: readonly string[] = Intl.supportedValuesOf("timeZone");

const segmentClass = (active: boolean): string => {
  return cx(
    "cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition-colors duration-150",
    active ? "border-lime bg-lime text-stone-900" : "border-stone-300 bg-white text-stone-600 hover:border-stone-400",
  );
};

function ProfileCard({ learner }: { learner: Learner }) {
  return (
    <Card className="grid gap-6">
      <h2 className="font-montserrat text-lg font-semibold text-stone-900">
        <User className="mr-2 inline size-5 align-text-bottom text-stone-500" aria-hidden="true" />
        Profile
      </h2>

      <div className="flex items-center gap-4">
        <Avatar name={learner.name} src={learner.avatarUrl} size="lg" tone="light" className="size-14" />

        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-stone-900">{learner.name}</p>
          <p className="truncate text-sm text-stone-500">{learner.email}</p>
        </div>
      </div>
    </Card>
  );
}

function StudyPreferences({
  settings,
  onSaved,
}: {
  settings: LearnerSettings;
  onSaved: (learner: Learner) => void;
}) {
  const [draft, setDraft] = useState<SettingsDraft>(() => draftFrom(settings));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const parsed = parseDraft(draft);
  const patch = parsed.ok ? changedSettings(settings, parsed.settings) : {};
  const dirty = Object.keys(patch).length > 0;

  const change = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setNotice(null);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const next = parseDraft(draft);

    if (!next.ok) {
      setErrors(next.errors);
      setNotice(null);
      return;
    }

    const changes = changedSettings(settings, next.settings);

    setErrors({});
    setNotice(null);

    if (Object.keys(changes).length === 0) return;

    setSaving(true);

    const result = await session.call((client) => client.me.updateSettings({ payload: changes }));

    setSaving(false);

    if (Result.isSuccess(result)) {
      onSaved(result.success);
      setNotice({ kind: "saved" });
      return;
    }

    setNotice({ kind: "failed" });
  };

  // The current zone stays in the list even when the browser does not know it, so the select always shows it.
  const zoneOptions = timeZones.includes(draft.timezone) ? timeZones : [draft.timezone, ...timeZones];

  return (
    <Card className="grid gap-6">
      <h2 className="font-montserrat text-lg font-semibold text-stone-900">
        <SlidersHorizontal className="mr-2 inline size-5 align-text-bottom text-stone-500" aria-hidden="true" />
        Study preferences
      </h2>

      <form className="grid gap-5" onSubmit={save} noValidate>
        <div className="grid gap-1.5">
          <label htmlFor="settings-timezone" className="text-sm font-medium text-stone-700">
            Timezone
          </label>
          <select
            id="settings-timezone"
            value={draft.timezone}
            onChange={(event) => change("timezone", event.target.value)}
            className="w-full cursor-pointer rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime/60"
          >
            {zoneOptions.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Day starts at (hour, 0–23)"
          type="text"
          inputMode="numeric"
          value={draft.dayStartHour}
          onChange={(event) => change("dayStartHour", event.target.value)}
          error={errors.dayStartHour}
        />

        <Input
          label="Desired retention (%)"
          type="text"
          inputMode="numeric"
          value={draft.desiredRetention}
          onChange={(event) => change("desiredRetention", event.target.value)}
          error={errors.desiredRetention}
        />

        <Input
          label="New words per day"
          type="text"
          inputMode="numeric"
          value={draft.newPerDay}
          onChange={(event) => change("newPerDay", event.target.value)}
          error={errors.newPerDay}
        />

        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-medium text-stone-700">Default session size</legend>
          <div className="flex flex-wrap gap-2">
            {SESSION_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={draft.defaultSessionSize === size}
                className={segmentClass(draft.defaultSessionSize === size)}
                onClick={() => change("defaultSessionSize", size)}
              >
                {size} words
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-medium text-stone-700">Default mode</legend>
          <div className="flex flex-wrap gap-2">
            {MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                aria-pressed={draft.defaultMode === mode.value}
                title={mode.hint}
                className={segmentClass(draft.defaultMode === mode.value)}
                onClick={() => change("defaultMode", mode.value)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>

          {notice?.kind === "saved" && (
            <p role="status" className="text-sm text-stone-600">
              Saved.
            </p>
          )}

          {notice?.kind === "failed" && (
            <p role="alert" className="text-sm text-red-600">
              Couldn't save your settings. Try again.
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}

export function SettingsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    void session.call((client) => client.me.get()).then((result) => {
      if (!active) return;

      setState(Result.isSuccess(result) ? { kind: "loaded", learner: result.success } : { kind: "failed" });
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="w-full py-6 sm:py-8">
      <header className="mb-8 flex items-center gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime/20">
          <SettingsIcon className="size-5 text-stone-900" aria-hidden="true" />
        </div>

        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-stone-900">Settings</h1>
          <p className="mt-0.5 text-sm text-stone-500">Manage your account and study preferences.</p>
        </div>
      </header>

      {state.kind === "loading" && <p className="text-sm text-stone-500">Loading…</p>}

      {state.kind === "failed" && (
        <p role="alert" className="text-sm text-red-600">
          Couldn't load your settings.
        </p>
      )}

      {state.kind === "loaded" && (
        <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-2">
          <ProfileCard learner={state.learner} />

          <StudyPreferences
            settings={state.learner.settings}
            onSaved={(learner) => setState({ kind: "loaded", learner })}
          />
        </div>
      )}
    </div>
  );
}
