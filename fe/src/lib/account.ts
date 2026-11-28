const notImplemented = (): never => {
  throw new Error("not implemented: AF")
}

export const emailMatches = (typed: string, email: string): boolean => notImplemented() || typed === email

export const deleteAccount = (): Promise<boolean> => Promise.reject(new Error("not implemented: AF"))

export const takeDeletedNotice = (): boolean => notImplemented()
