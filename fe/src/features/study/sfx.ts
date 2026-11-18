const STORAGE_KEY = "voca.sfx";

type AudioWindow = {
  AudioContext?: new () => AudioContext;
  webkitAudioContext?: new () => AudioContext;
};

type Tone = {
  readonly type: OscillatorType;
  readonly frequency: number;
  readonly duration: number;
  readonly at?: number | undefined;
  readonly glideTo?: number | undefined;
  readonly lowpass?: number | undefined;
  readonly gain?: number | undefined;
};

// One context for the page's life: browsers cap how many can exist, and each one starts suspended.
let shared: AudioContext | null = null;

const createContext = (): AudioContext | null => {
  const target = window as unknown as AudioWindow;
  const Constructor = target.AudioContext ?? target.webkitAudioContext;

  if (Constructor === undefined) return null;

  return new Constructor();
};

const sharedContext = (): AudioContext | null => {
  if (shared === null) shared = createContext();

  return shared;
};

const resume = (audio: AudioContext): void => {
  if (audio.state !== "suspended") return;

  // A rejected resume only means the sound stays silent, so the rejection is dropped.
  audio.resume().catch(() => undefined);
};

export const isMuted = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "off";
  } catch {
    return false;
  }
};

export const setMuted = (muted: boolean): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? "off" : "on");
  } catch {
    // Blocked storage: the choice is not kept, and sound stays on.
  }
};

// Called from a user gesture, so browsers allow the suspended context to start.
export const unlock = (): void => {
  const audio = sharedContext();

  if (audio !== null) resume(audio);
};

const schedule = (audio: AudioContext, tone: Tone): void => {
  const begin = audio.currentTime + (tone.at ?? 0);
  const end = begin + tone.duration;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();

  oscillator.type = tone.type;
  oscillator.frequency.setValueAtTime(tone.frequency, begin);

  if (tone.glideTo !== undefined) oscillator.frequency.exponentialRampToValueAtTime(tone.glideTo, end);

  // The 5 ms attack and the fade to silence keep a note from clicking at either edge.
  envelope.gain.setValueAtTime(0.0001, begin);
  envelope.gain.linearRampToValueAtTime(tone.gain ?? 0.2, begin + 0.005);
  envelope.gain.exponentialRampToValueAtTime(0.0001, end);

  if (tone.lowpass !== undefined) {
    const filter = audio.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.value = tone.lowpass;

    oscillator.connect(filter);
    filter.connect(envelope);
  } else {
    oscillator.connect(envelope);
  }

  envelope.connect(audio.destination);

  oscillator.start(begin);
  oscillator.stop(end);
};

const play = (tones: readonly Tone[]): void => {
  if (isMuted()) return;

  const audio = sharedContext();

  if (audio === null) return;

  resume(audio);

  for (const tone of tones) schedule(audio, tone);
};

export const sfx = {
  start: (): void => {
    play([{ type: "sine", frequency: 440, glideTo: 660, duration: 0.12 }]);
  },
  select: (): void => {
    play([{ type: "sine", frequency: 880, duration: 0.03 }]);
  },
  correct: (): void => {
    play([
      { type: "triangle", frequency: 1046.5, duration: 0.08 },
      { type: "triangle", frequency: 1568, duration: 0.08, at: 0.08 }
    ]);
  },
  wrong: (): void => {
    play([{ type: "square", frequency: 220, glideTo: 147, duration: 0.22, lowpass: 1200, gain: 0.15 }]);
  },
  retry: (): void => {
    play([
      { type: "sine", frequency: 523.25, duration: 0.04 },
      { type: "sine", frequency: 523.25, duration: 0.04, at: 0.08 }
    ]);
  },
  complete: (): void => {
    play([
      { type: "triangle", frequency: 523.25, duration: 0.09 },
      { type: "triangle", frequency: 659.25, duration: 0.09, at: 0.09 },
      { type: "triangle", frequency: 783.99, duration: 0.09, at: 0.18 },
      { type: "triangle", frequency: 1046.5, duration: 0.09, at: 0.27 }
    ]);
  }
};
