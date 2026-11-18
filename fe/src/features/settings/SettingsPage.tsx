import { useEffect, useState, type FormEvent } from "react";
import { Result } from "effect";
import type { Learner, LearnerSettings, Mode, SessionSize } from "@voca/contract";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { Input } from "../../components/Input";
import { PageHeader } from "../../components/PageHeader";
import { SegmentedControl } from "../../components/SegmentedControl";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { changedSettings, draftFrom, parseDraft, type DraftErrors, type SettingsDraft } from "./settingsModel";
import { SettingsSection } from "./SettingsSection";

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "loaded"; readonly learner: Learner };

type Notice = { readonly kind: "saved" } | { readonly kind: "failed" } | null;

const SESSION_SIZES: readonly SessionSize[] = [7, 10, 15, 20];

const MODES: readonly { readonly value: Mode; readonly label: string; readonly hint: string }[] = [
  { value: "easy", label: "Easy", hint: "Recognise the answer." },
  { value: "hard", label: "Hard", hint: "Recall it from memory." },
];

const timeZones: readonly string[] = Intl.supportedValuesOf("timeZone");

const controlClass =
  "h-8 w-full cursor-pointer rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";

function ProfileSection({ learner }: { learner: Learner }) {
  return (
    <SettingsSection title="Profile" description="Your name and picture come from your Google account.">
      <div className="flex items-center gap-4">
        <Avatar name={learner.name} src={learner.avatarUrl} size="lg" className="size-14" />

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">{learner.name}</p>
          <p className="truncate text-sm text-stone-500">{learner.email}</p>
        </div>
      </div>
    </SettingsSection>
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
  const activeMode = MODES.find((mode) => mode.value === draft.defaultMode);

  return (
    <SettingsSection
      title="Study preferences"
      description="How sessions start and when words come back."
    >
      <form className="grid gap-6" onSubmit={save} noValidate>
        <div className="grid gap-1.5">
          <label htmlFor="settings-timezone" className="text-xs font-medium text-stone-700">
            Timezone
          </label>
          <select
            id="settings-timezone"
            value={draft.timezone}
            onChange={(event) => change("timezone", event.target.value)}
            className={controlClass}
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

        <div className="grid gap-2">
          <p className="text-xs font-medium text-stone-700">Default session size</p>
          <SegmentedControl
            label="Default session size"
            options={SESSION_SIZES.map((size) => ({ value: String(size), label: `${size} words` }))}
            value={String(draft.defaultSessionSize)}
            onChange={(value) => {
              const size = SESSION_SIZES.find((candidate) => String(candidate) === value);
              if (size !== undefined) change("defaultSessionSize", size);
            }}
          />
        </div>

        <div className="grid gap-2">
          <p className="text-xs font-medium text-stone-700">Default mode</p>
          <SegmentedControl
            label="Default mode"
            options={MODES.map((mode) => ({ value: mode.value, label: mode.label }))}
            value={draft.defaultMode}
            onChange={(value) => change("defaultMode", value)}
          />
          {activeMode !== undefined && <p className="text-xs text-stone-500">{activeMode.hint}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!dirty || saving} busy={saving}>
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
    </SettingsSection>
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
      <PageHeader title="Settings" description="Manage your account and study preferences." />

      {state.kind === "loading" && <Skeleton label="Loading settings" rows={3} />}

      {state.kind === "failed" && <ErrorState message="Couldn't load your settings." />}

      {state.kind === "loaded" && (
        <div className="grid gap-8">
          <ProfileSection learner={state.learner} />

          <StudyPreferences
            settings={state.learner.settings}
            onSaved={(learner) => setState({ kind: "loaded", learner })}
          />
        </div>
      )}
    </div>
  );
}
