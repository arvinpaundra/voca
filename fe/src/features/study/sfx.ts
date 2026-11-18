const NOT_IMPLEMENTED = "not implemented: SFX";

export const isMuted = (): boolean => {
  throw new Error(NOT_IMPLEMENTED);
};

export const setMuted = (_muted: boolean): void => {
  throw new Error(NOT_IMPLEMENTED);
};

export const unlock = (): void => {
  throw new Error(NOT_IMPLEMENTED);
};

export const sfx = {
  start: (): void => {
    throw new Error(NOT_IMPLEMENTED);
  },
  select: (): void => {
    throw new Error(NOT_IMPLEMENTED);
  },
  correct: (): void => {
    throw new Error(NOT_IMPLEMENTED);
  },
  wrong: (): void => {
    throw new Error(NOT_IMPLEMENTED);
  },
  retry: (): void => {
    throw new Error(NOT_IMPLEMENTED);
  },
  complete: (): void => {
    throw new Error(NOT_IMPLEMENTED);
  }
};
