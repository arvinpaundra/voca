import type { Drill, SessionSize } from "@voca/contract";
import type { HardDrill } from "./hardDrills";

export function HardStudySetup(_props: {
  drills: readonly HardDrill[];
  defaultSize: SessionSize;
  busy?: boolean;
  error?: string | null;
  onStart: (drills: readonly Drill[], size: SessionSize) => void;
}) {
  return <p>not implemented: F-H</p>;
}
