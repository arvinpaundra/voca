import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Result } from "effect";
import type { Learner, Notifications } from "@voca/contract";
import { session, tokenStore } from "../lib/appSession";
import { loadCurrentLearner } from "../lib/signIn";
import type { Loadable } from "../lib/loadable";

/** The shell's own fetches, injectable so tests can count them. `null` means the call failed. */
export type AppDataLoaders = {
  readonly learner: () => Promise<Learner | null>;
  readonly notifications: () => Promise<Notifications | null>;
};

/** The data the shell and every page below it share. */
export type AppData = {
  readonly learner: Loadable<Learner>;
  readonly notifications: Loadable<Notifications>;
  /** After saving settings: the new Learner, without asking the server again. */
  readonly setLearner: (learner: Learner) => void;
  /** After something that changes the queue: fetch the counts once more. */
  readonly reloadNotifications: () => void;
};

const defaultLoaders: AppDataLoaders = {
  learner: () => loadCurrentLearner(session, tokenStore),
  notifications: async () => {
    const result = await session.call((client) => client.insight.notifications());

    return Result.isSuccess(result) ? result.success : null;
  },
};

const AppDataContext = createContext<AppData | null>(null);

/** Loads the Learner and the counts once, for the shell and every page under it. */
export function AppDataProvider({
  children,
  loaders = defaultLoaders,
}: {
  children: ReactNode;
  loaders?: AppDataLoaders;
}): ReactNode {
  const [learner, setLearnerState] = useState<Loadable<Learner>>({ kind: "loading" });
  const [notifications, setNotificationsState] = useState<Loadable<Notifications>>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  // The Learner is never reloaded: settings changes arrive through setLearner.
  useEffect(() => {
    let active = true;

    void loaders.learner().then((found) => {
      if (!active) return;

      setLearnerState(found === null ? { kind: "failed" } : { kind: "loaded", value: found });
    });

    return () => {
      active = false;
    };
  }, []);

  // The previous counts stay on screen while a reload is in flight, so the badge does not flicker.
  useEffect(() => {
    let active = true;

    void loaders.notifications().then((found) => {
      if (!active) return;

      setNotificationsState(found === null ? { kind: "failed" } : { kind: "loaded", value: found });
    });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const setLearner = useCallback((next: Learner) => {
    setLearnerState({ kind: "loaded", value: next });
  }, []);

  const reloadNotifications = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const value = useMemo<AppData>(
    () => ({ learner, notifications, setLearner, reloadNotifications }),
    [learner, notifications, setLearner, reloadNotifications],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

/** The shared data. Throws when used outside the provider, which is a wiring bug. */
export function useAppData(): AppData {
  const data = useContext(AppDataContext);

  if (data === null) throw new Error("useAppData must be used inside an AppDataProvider");

  return data;
}
