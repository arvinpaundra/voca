import type { Socket, TCPSocketListener } from "bun"

interface Side {
  peer?: Socket<Side>
  pending: Array<Uint8Array>
}

/**
 * A TCP proxy in front of the test beanstalkd (preload.ts). `drop` closes every connection while it keeps listening,
 * as a beanstalkd restart does; `stop` also stops listening, as while it is down; `listen` brings it back on the same
 * port.
 */
export const makeBeanstalkProxy = () => {
  const target = {
    hostname: process.env.TEST_BEANSTALKD_HOST ?? "127.0.0.1",
    port: Number(process.env.TEST_BEANSTALKD_PORT)
  }

  const open = new Set<Socket<Side>>()
  let listener: TCPSocketListener<Side> | undefined
  let port = 0

  const forward = (to: Socket<Side> | undefined, chunk: Uint8Array, queue: Array<Uint8Array>) => {
    if (to === undefined) {
      queue.push(chunk)
    } else {
      to.write(chunk)
    }
  }

  const listen = () => {
    listener = Bun.listen<Side>({
      hostname: "127.0.0.1",
      port,
      socket: {
        open(client) {
          client.data = { pending: [] }
          open.add(client)

          void Bun.connect<Side>({
            ...target,
            socket: {
              open(upstream) {
                upstream.data = { peer: client, pending: [] }
                client.data.peer = upstream

                for (const chunk of client.data.pending) {
                  upstream.write(chunk)
                }

                client.data.pending = []
              },
              data(upstream, chunk) {
                upstream.data.peer?.write(chunk)
              },
              close(upstream) {
                upstream.data.peer?.end()
              }
            }
          })
        },
        data(client, chunk) {
          forward(client.data.peer, chunk, client.data.pending)
        },
        close(client) {
          open.delete(client)
          client.data.peer?.end()
        }
      }
    })

    port = listener.port
  }

  // Lets both ends see the close before the test goes on.
  const settle = () => Bun.sleep(100)

  const drop = () => {
    for (const client of open) {
      client.data.peer?.end()
      client.terminate()
    }

    return settle()
  }

  const stop = () => {
    listener?.stop(true)
    listener = undefined

    return drop()
  }

  listen()

  return {
    endpoint: { host: "127.0.0.1", port },
    drop,
    stop,
    listen
  }
}
