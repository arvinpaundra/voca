import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isMuted, setMuted, unlock } from "./sfx";

// Plain button rather than IconButton: the toggle needs aria-pressed, which IconButton does not pass through.
export function SfxToggle() {
  const [muted, setMutedState] = useState(isMuted);

  const toggle = () => {
    unlock();

    const next = !muted;

    setMuted(next);
    setMutedState(next);
  };

  const label = muted ? "Unmute sound effects" : "Mute sound effects";

  return (
    <button
      type="button"
      className="btn-icon round rounded-full bg-[#e7e5e4] text-[var(--ink)]"
      aria-label={label}
      aria-pressed={muted}
      title={label}
      onClick={toggle}
    >
      {muted ? <VolumeX className="i" aria-hidden="true" /> : <Volume2 className="i" aria-hidden="true" />}
    </button>
  );
}
