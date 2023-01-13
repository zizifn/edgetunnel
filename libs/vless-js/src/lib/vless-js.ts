export function vlessJs(): string {
  return 'vless-js';
}

function delay(ms: number) {
  return new Promise((resolve, rej) => {
    setTimeout(resolve, ms);
  });
}
export async function processWebSocket({
  userID,
  webSocket,
  rawTCPFactory,
  libs: { uuid, lodash },
}: {
  userID: string;
  webSocket: WebSocket;
  rawTCPFactory: (port: number, hostname: string) => Promise<any>;
  libs: { uuid: any; lodash: any };
}) {
  let address = '';
  let port = 0;
  let remoteConnection: {
    readable: any;
    writable: any;
    write: (arg0: Uint8Array) => any;
    close: () => void;
  } | null = null;
  let remoteConnectionReadyResolve: Function;
  try {
    const log = (info: string, event?: any) => {
      console.log(`[${address}:${port}] ${info}`, event || '');
    };
    const readableWebSocketStream = makeReadableWebSocketStream(webSocket, log);
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
            if (vlessBuffer.byteLength < 24) {
              console.log('invalid data');
              controller.error('invalid data');
              return;
            }
            const version = new Uint8Array(vlessBuffer.slice(0, 1));
            let isValidUser = false;
            if (
              uuid.stringify(new Uint8Array(vlessBuffer.slice(1, 17))) ===
              userID
            ) {
              isValidUser = true;
            }
            if (!isValidUser) {
              console.log('in valid user');
              controller.error('in valid user');
              return;
            }

            const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
            //skip opt for now

            const command = new Uint8Array(
              vlessBuffer.slice(18 + optLength, 18 + optLength + 1)
            )[0];
            // 0x01 TCP
            // 0x02 UDP
            // 0x03 MUX
            if (command === 1) {
            } else {
              controller.error(
                `command ${command} is not support, command 01-tcp,02-udp,03-mux`
              );
              return;
            }
            const portIndex = 18 + optLength + 1;
            const portBuffer = vlessBuffer.slice(portIndex, portIndex + 2);
            // port is big-Endian in raw data etc 80 == 0x005d
            const portRemote = new DataView(portBuffer).getInt16(0);
            port = portRemote;
            let addressIndex = portIndex + 2;
            const addressBuffer = new Uint8Array(
              vlessBuffer.slice(addressIndex, addressIndex + 1)
            );

            // 1--> ipv4  addressLength =4
            // 2--> domain name addressLength=addressBuffer[1]
            // 3--> ipv6  addressLength =16
            const addressType = addressBuffer[0];
            let addressLength = 0;
            let addressValueIndex = addressIndex + 1;
            let addressValue = '';
            switch (addressType) {
              case 1:
                addressLength = 4;
                addressValue = new Uint8Array(
                  vlessBuffer.slice(
                    addressValueIndex,
                    addressValueIndex + addressLength
                  )
                ).join('.');
                break;
              case 2:
                addressLength = new Uint8Array(
                  vlessBuffer.slice(addressValueIndex, addressValueIndex + 1)
                )[0];
                addressValueIndex += 1;
                addressValue = new TextDecoder().decode(
                  vlessBuffer.slice(
                    addressValueIndex,
                    addressValueIndex + addressLength
                  )
                );
                break;
              case 3:
                addressLength = 16;
                const addressChunkBy2: number[][] = lodash.chunk(
                  new Uint8Array(
                    vlessBuffer.slice(
                      addressValueIndex,
                      addressValueIndex + addressLength
                    )
                  ),
                  2,
                  null
                );
                // 2001:0db8:85a3:0000:0000:8a2e:0370:7334
                addressValue = addressChunkBy2
                  .map((items) =>
                    items
                      .map((item) => item.toString(16).padStart(2, '0'))
                      .join('')
                  )
                  .join(':');
                break;
              default:
                console.log(`[${address}:${port}] invild address`);
            }
            address = addressValue;
            if (!addressValue) {
              // console.log(`[${address}:${port}] addressValue is empty`);
              controller.error(`[${address}:${port}] addressValue is empty`);
              return;
            }
            // const addressType = requestAddr >> 4;
            // const addressLength = requestAddr & 0x0f;
            console.log(`[${addressValue}:${port}] connecting`);
            remoteConnection = await rawTCPFactory(port, addressValue);
            vlessResponseHeader = new Uint8Array([version[0], 0]);
            const rawDataIndex = addressValueIndex + addressLength;
            const rawClientData = vlessBuffer.slice(rawDataIndex);
            await remoteConnection!.write(new Uint8Array(rawClientData));
            remoteConnectionReadyResolve(remoteConnection);
          },
        })
      )
      .catch((error) => {
        console.log(
          `[${address}:${port}] readableWebSocketStream pipeto has exception`,
          error.stack || error
        );
        closeWebSocket(webSocket);
        // close remote conn
        remoteConnection?.close();
      });
    await new Promise((resolve) => (remoteConnectionReadyResolve = resolve));
    let remoteChunkCount = 0;
    let totoal = 0;
    // remote --> ws
    await remoteConnection!.readable.pipeTo(
      new WritableStream({
        start() {
          webSocket.send(vlessResponseHeader!);
        },
        async write(chunk: Uint8Array, controller) {
          function send2WebSocket() {
            if (webSocket.readyState !== webSocket.OPEN) {
              controller.error(
                `[${address}:${port}] abort when webSocket is close can't accept data from remoteConnection!.readable`
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
            `[${address}:${port}] remoteConnection!.readable is close`
          );
        },
        abort(reason) {
          closeWebSocket(webSocket);
          console.error(
            `[${address}:${port}] remoteConnection!.readable abort`,
            reason
          );
        },
      })
    );
  } catch (error: any) {
    console.error(
      `[${address}:${port}] processWebSocket has esception `,
      error.stack || error
    );
    closeWebSocket(webSocket);
  }
  return;
}

function makeReadableWebSocketStream(ws: WebSocket, log: Function) {
  return new ReadableStream({
    start(controller) {
      ws.addEventListener('message', async (e) => {
        const vlessBuffer: ArrayBuffer = e.data;
        // console.log(`message is ${vlessBuffer.byteLength}`);
        controller.enqueue(vlessBuffer);
      });
      ws.addEventListener('error', (e) => {
        log('socket has error', e);
        controller.error(e);
      });
      ws.addEventListener('close', () => {
        try {
          log('socket is close');
          controller.close();
        } catch (error) {
          log(`websocketStream can't close`);
        }
      });
    },
    pull(controller) {},
    cancel(reason) {
      log(`websocketStream is cancel`, reason);
      ws.close();
    },
  });
}

function closeWebSocket(socket: WebSocket) {
  if (socket.readyState === socket.OPEN) {
    socket.close();
  }
}
