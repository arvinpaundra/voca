import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Result } from "effect";
import { Check } from "lucide-react";
import type { Learner, LearnerSettings, Mode, SessionSize } from "@voca/contract";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { Input } from "../../components/Input";
import { PageHeader } from "../../components/PageHeader";
import { SegmentedControl } from "../../components/SegmentedControl";
import { Select } from "../../components/Select";
import { Skeleton } from "../../components/Skeleton";
import { Tooltip } from "../../components/Tooltip";
import { session } from "../../lib/appSession";
import { meQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { changedSettings, draftFrom, parseDraft, type DraftErrors, type SettingsDraft } from "./settingsModel";
import { SettingsRow } from "./SettingsRow";
import { SettingsSection } from "./SettingsSection";
import { WordFontSection } from "./WordFontSection";

type Notice = { readonly kind: "saved" } | { readonly kind: "failed" } | null;

const SESSION_SIZES: readonly SessionSize[] = [7, 10, 15, 20];

const MODES: readonly { readonly value: Mode; readonly label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "hard", label: "Hard" },
];

const DAY_START_HOURS: readonly number[] = [0, 4, 6];

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

const timeZones: readonly string[] = Intl.supportedValuesOf("timeZone");

// A grid cell stretches its child across the card by default. Controls with short labels keep their own width.
function FitContent({ children }: { children: ReactNode }) {
  return <div style={{ justifySelf: "start", minWidth: 0, maxWidth: "100%" }}>{children}</div>;
}

function ProfileSection({ learner }: { learner: Learner }) {
  return (
    <SettingsSection title="Profile">
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <Avatar name={learner.name} src={learner.avatarUrl} size="lg" />

        <div>
          <b>{learner.name}</b>
          <div className="muted" style={{ fontSize: 13 }}>
            {`${learner.email} · Signed in with Google`}
          </div>
        </div>

        <span style={{ marginLeft: "auto" }}>
          <Button variant="ghost" size="sm" onClick={() => void session.signOut()}>
            Sign out
          </Button>
        </span>
      </div>
    </SettingsSection>
  );
}

function StudyPreferences({ settings }: { settings: LearnerSettings }) {
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
      // The saved settings come back through the cached learner, so every page that shows them refetches.
      void queryClient.invalidateQueries();
      setNotice({ kind: "saved" });
      return;
    }

    setNotice({ kind: "failed" });
  };

  // The current zone stays in the list even when the browser does not know it, so the select always shows it.
  const zoneOptions = timeZones.includes(draft.timezone) ? timeZones : [draft.timezone, ...timeZones];
  const hours = [...new Set([...DAY_START_HOURS, settings.dayStartHour])].sort((first, second) => first - second);

  const reset = () => {
    setDraft(draftFrom(settings));
    setErrors({});
    setNotice(null);
  };

  return (
    <SettingsSection title="Study preferences">
      <form onSubmit={save} noValidate>
        <div>
          <SettingsRow label="Timezone" help="Sets when your day starts">
            <Select
              label="Timezone"
              value={draft.timezone}
              options={zoneOptions.map((zone) => ({ value: zone, label: zone }))}
              onChange={(value) => change("timezone", value)}
            />
          </SettingsRow>

          <SettingsRow label="Day starts at" help="Reviews after this hour count for the new day">
            <FitContent>
              <SegmentedControl
                label="Day starts at"
                options={hours.map((hour) => ({ value: String(hour), label: hourLabel(hour) }))}
                value={draft.dayStartHour}
                onChange={(value) => change("dayStartHour", value)}
              />
            </FitContent>
          </SettingsRow>

          <SettingsRow label="Desired retention" help="How likely you want to recall a word when it comes back (80-95%)">
            <FitContent>
              <Input
                aria-label="Desired retention (%)"
                type="text"
                inputMode="numeric"
                value={draft.desiredRetention}
                onChange={(event) => change("desiredRetention", event.target.value)}
                error={errors.desiredRetention}
              />
            </FitContent>
          </SettingsRow>

          <SettingsRow
            label="New cards per day"
            help="A daily target. Reaching it doesn't stop new cards."
            info={<Tooltip label="What is a card?">A card is one word in one drill.</Tooltip>}
          >
            <FitContent>
              <Input
                aria-label="New cards per day"
                type="text"
                inputMode="numeric"
                value={draft.newPerDay}
                onChange={(event) => change("newPerDay", event.target.value)}
                error={errors.newPerDay}
              />
            </FitContent>
          </SettingsRow>

          <SettingsRow label="Default session size" help="Change it per session in setup">
            <FitContent>
              <SegmentedControl
                label="Default session size"
                options={SESSION_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
                value={String(draft.defaultSessionSize)}
                onChange={(value) => {
                  const size = SESSION_SIZES.find((candidate) => String(candidate) === value);
                  if (size !== undefined) change("defaultSessionSize", size);
                }}
              />
            </FitContent>
          </SettingsRow>

          <SettingsRow label="Default mode" help="Hard mode picks look-alike options">
            <FitContent>
              <SegmentedControl
                label="Default mode"
                options={MODES}
                value={draft.defaultMode}
                onChange={(value) => change("defaultMode", value)}
              />
            </FitContent>
          </SettingsRow>
        </div>

        {notice?.kind === "failed" && (
          <div role="alert" className="alert alert-bad">
            <span className="grow">Couldn't save your settings. Try again.</span>
          </div>
        )}

        <div
          className="form-actions"
          style={{ borderTop: "1px solid var(--line)", paddingTop: 16, alignItems: "center", marginTop: 16 }}
        >
          {notice?.kind === "saved" && (
            <span className="status" role="status" style={{ marginRight: "auto" }}>
              <Check className="i" aria-hidden="true" />
              Saved
            </span>
          )}

          <Button variant="ghost" onClick={reset}>
            Reset
          </Button>

          <Button type="submit" disabled={!dirty || saving} busy={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

export function SettingsPage() {
  const learner = useQuery(meQuery(), queryClient);

  return (
    <>
      <PageHeader title="Settings" description="Your account and how study sessions start." />

      {learner.isPending && <Skeleton label="Loading settings" rows={3} />}

      {learner.isError && <ErrorState message="Couldn't load your settings." />}

      {learner.isSuccess && (
        <div className="settings">
          <ProfileSection learner={learner.data} />

          <StudyPreferences settings={learner.data.settings} />

          <WordFontSection />
        </div>
      )}
    </>
  );
}
