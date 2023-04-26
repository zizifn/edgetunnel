import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';
import * as uuid from 'https://jspm.dev/uuid';
import { serveClient } from './client.ts';
import {
  safeCloseWebSocket,
  delay,
  makeReadableWebSocketStream,
  processVlessHeader,
} from 'vless-js';

const userID = Deno.env.get('UUID') || '';
let isVaildUser = uuid.validate(userID);
if (!isVaildUser) {
  console.log('not set valid UUID');
}

const handler = async (req: Request): Promise<Response> => {
  if (!isVaildUser) {
    const index401 = await Deno.readFile(
      `${Deno.cwd()}/dist/apps/cf-page/401.html`
    );
    return new Response(index401, {
      status: 401,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    });
  }
  const upgrade = req.headers.get('upgrade') || '';
  if (upgrade.toLowerCase() != 'websocket') {
    return await serveClient(req, userID);
  }
  const { socket, response } = Deno.upgradeWebSocket(req);
  socket.addEventListener('open', () => {});

  // let test: Deno.TcpConn | null = null;
  // test!.writable.abort();
  //
  const earlyDataHeader = req.headers.get('sec-websocket-protocol') || '';

  processWebSocket({
    userID,
    webSocket: socket,
    earlyDataHeader,
    // rawTCPFactory: (port: number, hostname: string) => {
    //   return Deno.connect({
    //     port,
    //     hostname,
    //   });
    // },
  });
  return response;
};

async function processWebSocket({
  userID,
  webSocket,
  earlyDataHeader,
}: // libs: { uuid, lodash },
{
  userID: string;
  webSocket: WebSocket;
  earlyDataHeader: string;
  // rawTCPFactory: (port: number, hostname: string) => Promise<any>;
  // libs: { uuid: any; lodash: any };
}) {
  let address = '';
  let portWithRandomLog = '';
  let remoteConnection: {
    readable: any;
    writable: any;
    write: (arg0: Uint8Array) => any;
    close: () => void;
  } | null = null;
  let remoteConnectionReadyResolve: Function;
  try {
    const log = (info: string, event?: any) => {
      console.log(`[${address}:${portWithRandomLog}] ${info}`, event || '');
    };
    const readableWebSocketStream = makeReadableWebSocketStream(
      webSocket,
      earlyDataHeader,
      log
    );
    let vlessResponseHeader: Uint8Array | null = null;

    // ws --> remote
    readableWebSocketStream
      .pipeTo(
        new WritableStream({
          async write(chunk, controller) {
            const vlessBuffer = chunk;
            if (remoteConnection) {
              const number = await remoteConnection.write(
                new Uint8Array(vlessBuffer)
              );
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
            } = processVlessHeader(vlessBuffer, userID);
            address = addressRemote || '';
            portWithRandomLog = `${portRemote}--${Math.random()}`;
            if (isUDP) {
              console.log('udp');
              controller.error(
                `[${address}:${portWithRandomLog}] command udp is not support `
              );
              return;
            }
            if (hasError) {
              controller.error(`[${address}:${portWithRandomLog}] ${message} `);
            }
            // const addressType = requestAddr >> 4;
            // const addressLength = requestAddr & 0x0f;
            console.log(`[${address}:${portWithRandomLog}] connecting`);
            remoteConnection = await Deno.connect({
              port: portRemote!,
              hostname: address,
            });
            vlessResponseHeader = new Uint8Array([vlessVersion![0], 0]);
            const rawClientData = vlessBuffer.slice(rawDataIndex!);
            await remoteConnection!.write(new Uint8Array(rawClientData));
            remoteConnectionReadyResolve(remoteConnection);
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
      )
      .catch((error) => {
        console.error(
          `[${address}:${portWithRandomLog}] readableWebSocketStream pipeto has exception`,
          error.stack || error
        );
        // error is cancel readable stream anyway, no need close websocket in here
        // safeCloseWebSocket(webSocket);
        // close remote conn
        // remoteConnection?.close();
      });
    await new Promise((resolve) => (remoteConnectionReadyResolve = resolve));
    let remoteChunkCount = 0;
    let totoal = 0;
    // remote --> ws
    await remoteConnection!.readable.pipeTo(
      new WritableStream({
        start() {
          if (webSocket.readyState === webSocket.OPEN) {
            webSocket.send(vlessResponseHeader!);
          }
        },
        async write(chunk: Uint8Array, controller) {
          function send2WebSocket() {
            if (webSocket.readyState !== webSocket.OPEN) {
              controller.error(
                `can't accept data from remoteConnection!.readable when client webSocket is close early`
              );
              return;
            }
            webSocket.send(chunk);
          }

          remoteChunkCount++;
          //#region
          // console.log(
          //   `${(totoal +=
          //     chunk.length)}, count: ${remoteChunkCount.toString()}, ${
          //     chunk.length
          //   }`
          // );
          // https://github.com/zizifn/edgetunnel/issues/87, hack for this issue, maybe websocket sent too many small chunk,
          // casue v2ray client can't process https://github.com/denoland/deno/issues/17332
          // limit X number count / bandwith, due to deno can't read bufferedAmount in deno,
          // this is deno bug and this will not need in nodejs version
          //#endregion
          if (remoteChunkCount < 20) {
            send2WebSocket();
          } else if (remoteChunkCount < 120) {
            await delay(10); // 64kb * 100 = 6m/s
            send2WebSocket();
          } else if (remoteChunkCount < 500) {
            await delay(20); // (64kb * 1000/20) = 3m/s
            send2WebSocket();
          } else {
            await delay(50); // (64kb * 1000/50)  /s
            send2WebSocket();
          }
        },
        close() {
          console.log(
            `[${address}:${portWithRandomLog}] remoteConnection!.readable is close`
          );
        },
        abort(reason) {
          safeCloseWebSocket(webSocket);
          console.error(
            `[${address}:${portWithRandomLog}] remoteConnection!.readable abort`,
            reason
          );
        },
      })
    );
  } catch (error: any) {
    console.error(
      `[${address}:${portWithRandomLog}] processWebSocket has exception `,
      error.stack || error
    );
    safeCloseWebSocket(webSocket);
  }
  return;
}

globalThis.addEventListener('beforeunload', (e) => {
  console.log('About to exit...');
});

globalThis.addEventListener('unload', (e) => {
  console.log('Exiting');
});
serve(handler, { port: 8080, hostname: '0.0.0.0' });
