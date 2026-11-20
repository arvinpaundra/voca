import type { ReactNode } from "react";
import type { Learner, Notifications } from "@voca/contract";

/** What a page can read while its data is in flight, has failed, or has arrived. */
export type Loadable<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "loaded"; readonly value: T };

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

/** Loads the Learner and the counts once, for the shell and every page under it. */
export function AppDataProvider({
  children,
  loaders,
}: {
  children: ReactNode;
  loaders?: AppDataLoaders;
}): ReactNode {
  throw new Error("not implemented: CTX");
}

/** The shared data. Throws when used outside the provider, which is a wiring bug. */
export function useAppData(): AppData {
  throw new Error("not implemented: CTX");
}
