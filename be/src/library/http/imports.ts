import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { VocaApi } from "@voca/contract"

const stub = () => Effect.die("not implemented: IB")

export const ImportsHandlers = HttpApiBuilder.group(
  VocaApi,
  "imports",
  (handlers) =>
    handlers.handleAll({
      importDecks: stub,
      listImports: stub,
      dismissImport: stub,
      importEventsTicket: stub
    })
)

export const ImportEventsHandlers = HttpApiBuilder.group(
  VocaApi,
  "importEvents",
  (handlers) => handlers.handleAll({ importEvents: stub })
)
