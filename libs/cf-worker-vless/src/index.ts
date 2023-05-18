import {
  makeReadableWebSocketStream,
  processVlessHeader,
  vlessJs,
} from 'vless-js';
import { connect } from 'cloudflare:sockets';
import { Buffer } from 'node:buffer';
import { validate } from 'uuid';

function delay(ms) {
  return new Promise((resolve, rej) => {
    setTimeout(resolve, ms);
  });
}

interface Env {
  UUID: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    let address = '';
    let portWithRandomLog = '';
    const userID = env.UUID;

    const log = (info: string, event?: any) => {
      console.log(`[${address}:${portWithRandomLog}] ${info}`, event || '');
    };

    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response(`Expected Upgrade: websocket--uuid--${userID}`, {
        status: 426,
      });
    }

    const webSocketPair = new WebSocketPair();
    const [client, webSocket] = Object.values(webSocketPair);

    const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
    let remoteSocket: TransformStream = null;
    webSocket.accept();

    const readableWebSocketStream = makeReadableWebSocketStream(
      webSocket,
      earlyDataHeader,
      log
    );
    let vlessResponseHeader = new Uint8Array([0, 0]);
    let remoteConnectionReadyResolve: Function;

    // ws-->remote

    readableWebSocketStream.pipeTo(
      new WritableStream({
        async write(chunk, controller) {
          if (remoteSocket) {
            const writer = remoteSocket.writable.getWriter();
            await writer.write(chunk);
            writer.releaseLock();
            return;
          }

          const {
            hasError,
            message,
            portRemote,
            addressRemote,
            rawDataIndex,
            vlessVersion,
            isUDP,
          } = processVlessHeader(chunk, userID);
          address = addressRemote || '';
          portWithRandomLog = `${portRemote}--${Math.random()} ${
            isUDP ? 'udp ' : 'tcp '
          } `;
          // if UDP but port not DNS port, close it
          if (isUDP && portRemote != 53) {
            controller.error('UDP proxy only enable for DNS which is port 53');
            webSocket.close(); // server close will not casuse worker throw error
            return;
          }
          if (hasError) {
            controller.error(message);
            webSocket.close(); // server close will not casuse worker throw error
            return;
          }
          vlessResponseHeader = new Uint8Array([vlessVersion![0], 0]);
          const rawClientData = chunk.slice(rawDataIndex!);
          remoteSocket = connect({
            hostname: addressRemote,
            port: portRemote,
          });
          log(`connected`);

          const writer = remoteSocket.writable.getWriter();
          await writer.write(rawClientData); // first write, nomal is tls client hello
          writer.releaseLock();

          // remoteSocket ready
          remoteConnectionReadyResolve(remoteSocket);
        },
        close() {
          console.log(
            `[${address}:${portWithRandomLog}] readableWebSocketStream is close`
          );
        },
        abort(reason) {
          console.log(
            `[${address}:${portWithRandomLog}] readableWebSocketStream is abort`,
            JSON.stringify(reason)
          );
        },
      })
    );

    (async () => {
      await new Promise((resolve) => (remoteConnectionReadyResolve = resolve));

      // remote--> ws
      let count = 0;
      remoteSocket.readable
        .pipeTo(
          new WritableStream({
            start() {
              if (webSocket.readyState === WebSocket.READY_STATE_OPEN) {
                webSocket.send(vlessResponseHeader!);
              }
            },
            async write(chunk: Uint8Array, controller) {
              if (webSocket.readyState === WebSocket.READY_STATE_OPEN) {
                if (count++ > 20000) {
                  // cf one package is 4096 byte(4kb),  4096 * 20000 = 80M
                  await delay(1);
                }
                webSocket.send(chunk);
                // console.log(chunk.byteLength);
              } else {
                controller.error(
                  'webSocket.readyState is not open, maybe close'
                );
              }
            },
            close() {
              console.log(
                `[${address}:${portWithRandomLog}] remoteConnection!.readable is close`
              );
            },
            abort(reason) {
              console.error(
                `[${address}:${portWithRandomLog}] remoteConnection!.readable abort`,
                reason
              );
            },
          })
        )
        .catch((error) => {
          console.error(
            `[${address}:${portWithRandomLog}] processWebSocket has exception `,
            error.stack || error
          );
          safeCloseWebSocket(webSocket);
        });
    })();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};

function safeCloseWebSocket(ws: WebSocket) {
  try {
    if (ws.readyState !== WebSocket.READY_STATE_CLOSED) {
      ws.close();
    }
  } catch (error) {
    console.error('safeCloseWebSocket error', error);
  }
}
