import { useEffect, useState } from "react";
import { Result } from "effect";
import type { Loadable } from "../../lib/loadable";

export type { Loadable };

/**
 * Runs one API call when the deps change. Each dashboard section owns its call, so one failing call
 * leaves the other sections rendered.
 */
export function useLoadable<T>(load: () => Promise<Result.Result<T, unknown>>, deps: readonly unknown[]): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    setState({ kind: "loading" });
    void load().then((result) => {
      if (!active) return;

      setState(Result.isSuccess(result) ? { kind: "loaded", value: result.success } : { kind: "failed" });
    });

    return () => {
      active = false;
    };
  }, deps);

  return state;
}
