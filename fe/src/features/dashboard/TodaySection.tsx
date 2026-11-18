import type { Learner, LearnerStats, Notifications } from "@voca/contract";
import type { Loadable } from "./useLoadable";

export function TodaySection(_props: {
  state: Loadable<Notifications>;
  stats: Loadable<LearnerStats>;
  learner: Learner;
}) {
  return <p>not implemented: UI-D2</p>;
}
