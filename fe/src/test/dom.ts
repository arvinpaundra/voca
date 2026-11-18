// Loaded before every fe test (bunfig.toml): a DOM for component tests.
// Bun's own fetch, Request and Response are kept, so the API and session tests still talk to their Bun.serve fakes.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const bunFetch = {
  fetch: globalThis.fetch,
  Request: globalThis.Request,
  Response: globalThis.Response,
  Headers: globalThis.Headers,
  AbortController: globalThis.AbortController,
  AbortSignal: globalThis.AbortSignal,
};

GlobalRegistrator.register({ url: "http://localhost:5173/" });

Object.assign(globalThis, bunFetch);

// Imported after the DOM exists: Testing Library reads `document` when it loads.
const { afterEach } = await import("bun:test");
const { cleanup } = await import("@testing-library/react");

afterEach(() => {
  cleanup();
});
