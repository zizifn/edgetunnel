import {
  makeReadableWebSocketStream,
  processVlessHeader,
  vlessJs,
} from 'vless-js';
import { connect } from 'cloudflare:sockets';
import { Buffer } from 'node:buffer';
import { validate } from 'uuid';

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

    console.log(WebSocket.READY_STATE_OPEN);

    const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
    let remoteSocket: TransformStream = null;
    webSocket.accept();
    webSocket.addEventListener('message', async (event) => {
      if (remoteSocket) {
        const writer = remoteSocket.writable.getWriter();
        await writer.write(event.data);
        writer.releaseLock();
        return;
      }
      const vlessBuffer: ArrayBuffer = event.data as ArrayBuffer;
      const {
        hasError,
        message,
        portRemote,
        addressRemote,
        rawDataIndex,
        vlessVersion,
        isUDP,
      } = processVlessHeader(vlessBuffer, userID);
      address = addressRemote || '';
      portWithRandomLog = `${portRemote}--${Math.random()} ${
        isUDP ? 'udp ' : 'tcp '
      } `;
      log(`connecting`);
      if (hasError) {
        webSocket.close(); // server close will not casuse worker throw error
      }
      const vlessResponseHeader = new Uint8Array([vlessVersion![0], 0]);
      const rawClientData = vlessBuffer.slice(rawDataIndex!);
      remoteSocket = connect({
        hostname: addressRemote,
        port: portRemote,
      });
      log(`connected`);

      const writer = remoteSocket.writable.getWriter();
      await writer.write(rawClientData); // first write, nomal is tls client hello
      writer.releaseLock();

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
                webSocket.send(chunk);
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

      // end
    });

    webSocket.addEventListener('close', async (event) => {
      console.log('-------------close-----------------', event);
    });

    webSocket.addEventListener('error', () => {
      console.log('-------------error-----------------');
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};

function safeCloseWebSocket(ws: WebSocket) {
  try {
    if (ws.readyState === WebSocket.READY_STATE_OPEN) {
      ws.close();
    }
  } catch (error) {
    console.error('safeCloseWebSocket error', error);
  }
}
