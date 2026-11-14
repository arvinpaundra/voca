// Runs before Testcontainers is imported. Picks the container runtime through DOCKER_HOST:
//   1. DOCKER_HOST already set  → used as is
//   2. Podman available         → its socket
//   3. otherwise                → nothing set; Testcontainers finds Docker by itself
// Ryuk (the cleanup container) is off by default: its log-based startup check hangs under Bun.
// preload.ts removes leftovers itself instead.
const podmanSocket = (): string | undefined => {
  if (!Bun.which("podman")) return undefined
  const mac = Bun.spawnSync(["podman", "machine", "inspect", "--format", "{{.ConnectionInfo.PodmanSocket.Path}}"])
  const macPath = mac.exitCode === 0 ? mac.stdout.toString().trim() : ""
  if (macPath) return macPath
  const runtimeDir = process.env.XDG_RUNTIME_DIR
  return runtimeDir ? `${runtimeDir}/podman/podman.sock` : undefined
}

if (!process.env.DOCKER_HOST) {
  const socket = podmanSocket()
  if (socket) process.env.DOCKER_HOST = `unix://${socket}`
}
process.env.TESTCONTAINERS_RYUK_DISABLED ??= "true"
