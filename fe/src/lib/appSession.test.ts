import { expect, spyOn, test } from "bun:test"
import { signedOut } from "./appSession"
import { queryClient } from "./queryClient"

test("signing out empties the query cache before leaving for the sign-in page", () => {
  const assign = spyOn(window.location, "assign").mockImplementation(() => {})
  queryClient.setQueryData(["me"], { name: "Previous Learner" })

  signedOut()

  expect(queryClient.getQueryData(["me"])).toBeUndefined()
  expect(assign).toHaveBeenCalledWith("/login")

  assign.mockRestore()
})
