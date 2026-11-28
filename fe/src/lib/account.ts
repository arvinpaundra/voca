import { Result } from "effect"
import { session, tokenStore } from "./appSession"
import { queryClient } from "./queryClient"

const DELETED_QUERY = "deleted"

const normalize = (value: string): string => value.trim().toLowerCase()

export const emailMatches = (typed: string, email: string): boolean => normalize(typed) === normalize(email)

export const deleteAccount = async (): Promise<boolean> => {
  const result = await session.call((client) => client.me.delete())

  if (!Result.isSuccess(result)) return false

  tokenStore.clear()
  queryClient.clear()
  window.location.assign(`/login?${DELETED_QUERY}`)

  return true
}

export const takeDeletedNotice = (): boolean => {
  const deleted = new URLSearchParams(window.location.search).has(DELETED_QUERY)

  if (deleted) window.history.replaceState(null, "", window.location.pathname)

  return deleted
}
