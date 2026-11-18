import { beforeEach, describe, expect, test } from "bun:test";
import { isMuted, setMuted, sfx, unlock } from "./sfx";

// The session sounds: short Web Audio tones, one shared context, a mute setting kept on the device.

type Param = {
  value: number;
  setValueAtTime: (value: number, time: number) => void;
  linearRampToValueAtTime: (value: number, time: number) => void;
  exponentialRampToValueAtTime: (value: number, time: number) => void;
  cancelScheduledValues: (time: number) => void;
};

type Osc = {
  type: string;
  frequency: Param;
  glides: { value: number; time: number }[];
  connected: boolean;
  started: number | null;
  stopped: number | null;
  connect: () => void;
  start: (time?: number) => void;
  stop: (time?: number) => void;
};

type Gain = { gain: Param; ramps: { value: number; time: number }[] };

const makeParam = (ramps: { value: number; time: number }[]): Param => {
  const param: Param = {
    value: 0,
    setValueAtTime: (value) => {
      param.value = value;
    },
    linearRampToValueAtTime: (value, time) => {
      ramps.push({ value, time });
    },
    exponentialRampToValueAtTime: (value, time) => {
      ramps.push({ value, time });
    },
    cancelScheduledValues: () => {}
  };

  return param;
};

const created = { last: null as FakeAudioContext | null, contexts: 0, oscillators: [] as Osc[], gains: [] as Gain[], filters: [] as { type: string }[], resumed: 0 };

class FakeAudioContext {
  currentTime = 0;
  state = "suspended";
  destination = {};

  constructor() {
    created.contexts += 1;
    created.last = this;
  }

  resume() {
    created.resumed += 1;
    this.state = "running";

    return Promise.resolve();
  }

  createOscillator(): Osc {
    const glides: { value: number; time: number }[] = [];
    const oscillator: Osc = {
      type: "sine",
      frequency: makeParam(glides),
      glides,
      connected: false,
      started: null,
      stopped: null,
      connect: () => {
        oscillator.connected = true;
      },
      start: (time = 0) => {
        oscillator.started = time;
      },
      stop: (time = 0) => {
        oscillator.stopped = time;
      }
    };

    created.oscillators.push(oscillator);

    return oscillator;
  }

  createGain(): Gain {
    const ramps: { value: number; time: number }[] = [];
    const gain: Gain = { gain: makeParam(ramps), ramps };

    created.gains.push(gain);

    return { ...gain, connect: () => {} } as Gain;
  }

  createBiquadFilter() {
    const filter = { type: "lowpass", frequency: makeParam([]), connect: () => {} };

    created.filters.push(filter);

    return filter;
  }
}

const target = window as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown };

const notes = () => created.oscillators.map((oscillator) => Math.round(oscillator.frequency.value));

beforeEach(() => {
  window.localStorage.clear();
  created.oscillators.length = 0;
  created.gains.length = 0;
  created.filters.length = 0;
  created.resumed = 0;
});

// This test runs first on purpose: the shared context is created lazily and then kept for the page's life.
describe("without the Web Audio API", () => {
  test("every sound call does nothing", () => {
    delete target.AudioContext;
    delete target.webkitAudioContext;

    expect(() => {
      sfx.start();
      sfx.select();
      sfx.correct();
      sfx.wrong();
      sfx.retry();
      sfx.complete();
      unlock();
    }).not.toThrow();

    expect(created.contexts).toBe(0);

    target.AudioContext = FakeAudioContext;
  });
});

describe("mute setting", () => {
  test("sound is on by default", () => {
    expect(isMuted()).toBe(false);
  });

  test("muting is kept on this device under voca.sfx", () => {
    setMuted(true);

    expect(window.localStorage.getItem("voca.sfx")).toBe("off");
    expect(isMuted()).toBe(true);

    setMuted(false);

    expect(isMuted()).toBe(false);
  });

  test("a stored mute is read back by a fresh page", () => {
    setMuted(true);

    // Nothing is cached in memory: the stored value decides.
    expect(isMuted()).toBe(true);

    window.localStorage.clear();

    expect(isMuted()).toBe(false);
  });

  test("a blocked localStorage leaves sound on and never throws", () => {
    const real = Object.getOwnPropertyDescriptor(window, "localStorage");

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("blocked");
      }
    });

    try {
      expect(isMuted()).toBe(false);
      expect(() => setMuted(true)).not.toThrow();
    } finally {
      if (real !== undefined) Object.defineProperty(window, "localStorage", real);
    }
  });

  test("muted, no sound is made", () => {
    setMuted(true);

    sfx.start();
    sfx.select();
    sfx.correct();
    sfx.wrong();
    sfx.retry();
    sfx.complete();

    expect(created.oscillators).toHaveLength(0);
  });
});

describe("the sounds", () => {
  test.each([
    ["start", 1],
    ["select", 1],
    ["correct", 2],
    ["wrong", 1],
    ["retry", 2],
    ["complete", 4]
  ] as const)("%s plays %i note(s), each one connected and scheduled", (name, count) => {
    sfx[name]();

    expect(created.oscillators).toHaveLength(count);

    for (const oscillator of created.oscillators) {
      expect(oscillator.connected).toBe(true);
      expect(oscillator.started).not.toBeNull();
      expect(oscillator.stopped).not.toBeNull();
      expect(oscillator.stopped as number).toBeGreaterThan(oscillator.started as number);
    }
  });

  test("correct: C6 then G6, triangle, one after the other", () => {
    sfx.correct();

    expect(notes()).toEqual([1047, 1568]);
    expect(created.oscillators.map((oscillator) => oscillator.type)).toEqual(["triangle", "triangle"]);
    expect(created.oscillators[1]?.started as number).toBeGreaterThan(created.oscillators[0]?.started as number);
  });

  test("complete: the arpeggio C5 E5 G5 C6, triangle", () => {
    sfx.complete();

    expect(notes()).toEqual([523, 659, 784, 1047]);
    expect(created.oscillators.every((oscillator) => oscillator.type === "triangle")).toBe(true);
  });

  test("select is a short 880 Hz tick", () => {
    sfx.select();

    const [tick] = created.oscillators;

    expect(Math.round(tick?.frequency.value ?? 0)).toBe(880);
    expect(tick?.type).toBe("sine");
    expect((tick?.stopped as number) - (tick?.started as number)).toBeLessThanOrEqual(0.06);
  });

  test("retry: two 523 Hz blips", () => {
    sfx.retry();

    expect(notes()).toEqual([523, 523]);
    expect(created.oscillators.every((oscillator) => oscillator.type === "sine")).toBe(true);
  });

  test("start glides up from 440 Hz to 660 Hz", () => {
    sfx.start();

    const [glide] = created.oscillators;

    expect(Math.round(glide?.frequency.value ?? 0)).toBe(440);
    expect(glide?.type).toBe("sine");
    expect(Math.round(glide?.glides.at(-1)?.value ?? 0)).toBe(660);
  });

  test("wrong is a low square through a lowpass filter", () => {
    sfx.wrong();

    const [buzz] = created.oscillators;

    expect(buzz?.type).toBe("square");
    expect(Math.round(buzz?.frequency.value ?? 0)).toBe(220);
    expect(Math.round(buzz?.glides.at(-1)?.value ?? 0)).toBe(147);
    expect(created.filters).toHaveLength(1);
    expect(created.filters[0]?.type).toBe("lowpass");
  });

  test("every note fades out exponentially to 0.0001, so it never clicks", () => {
    sfx.complete();

    expect(created.gains).toHaveLength(4);

    for (const gain of created.gains) {
      expect(gain.ramps.some((ramp) => ramp.value === 0.0001)).toBe(true);
    }
  });
});

describe("the shared context", () => {
  test("one AudioContext serves every sound", () => {
    const before = created.contexts;

    sfx.select();
    sfx.correct();
    sfx.complete();

    expect(created.contexts - before).toBeLessThanOrEqual(1);
  });

  test("unlock resumes a suspended context and leaves a running one alone", () => {
    sfx.select();

    const context = created.last as FakeAudioContext;

    context.state = "suspended";
    created.resumed = 0;

    unlock();

    expect(created.resumed).toBe(1);

    unlock();

    expect(created.resumed).toBe(1);
  });

  test("a sound on a suspended context asks it to resume", () => {
    sfx.select();

    (created.last as FakeAudioContext).state = "suspended";
    created.resumed = 0;

    sfx.correct();

    expect(created.resumed).toBe(1);
  });
});
