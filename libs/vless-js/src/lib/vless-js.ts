export function vlessJs(): string {
  return 'vless-js';
}

export async function processSocket({
  userID,
  socket,
  rawTCPFactory,
  libs: { uuid, lodash },
}: {
  userID: string;
  socket: WebSocket;
  rawTCPFactory: (port: number, hostname: string) => Promise<any>;
  libs: { uuid: any; lodash: any };
}) {
  let address = '';
  let port = 0;
  try {
    const websocketStream = new ReadableStream({
      start(controller) {
        socket.addEventListener('message', async (e) => {
          const vlessBuffer: ArrayBuffer = e.data;
          // console.log('request message  ', vlessBuffer.byteLength);
          controller.enqueue(vlessBuffer);
        });
        socket.addEventListener('error', (e) => {
          console.log(`[${address}:${port}] socket has error`, e);
          controller.error(e);
        });
        socket.addEventListener('close', () => {
          try {
            console.log(`[${address}:${port}] socket is close`);
            controller.close();
          } catch (error) {
            console.log(`[${address}:${port}] websocketStream can't close`);
          }
        });
      },
      pull(controller) {},
      cancel(reason) {
        console.log(`[${address}:${port}] websocketStream is cancel`, reason);
        socket.close();
      },
    });
    let remoteConnection: {
      readable: any;
      write: (arg0: Uint8Array) => any;
      close: () => void;
    } | null = null;

    await websocketStream.pipeTo(
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
            uuid.stringify(new Uint8Array(vlessBuffer.slice(1, 17))) === userID
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

          const rawDataIndex = addressValueIndex + addressLength;
          const rawClientData = vlessBuffer.slice(rawDataIndex);
          await remoteConnection!.write(new Uint8Array(rawClientData));
          let chunkDatas = [new Uint8Array([version[0], 0])];
          // let sizes = 0;
          // get response from remoteConnection
          remoteConnection!.readable
            .pipeTo(
              new WritableStream({
                start() {
                  socket.send(new Blob(chunkDatas));
                },
                async write(chunk, controller) {
                  // ('' as any).toLowerCase1();
                  // sizes += chunk.length;
                  // console.log('response size--', chunk.length);
                  // console.log('totoal size--', sizes);

                  // https://github.com/zizifn/edgetunnel/issues/87, hack for this issue, maybe websocket sent too many small chunk,
                  // casue v2ray client can't process
                  await new Promise((res, rej) => {
                    setTimeout(res, 2);
                  });
                  socket.send(chunk);
                },
                close() {
                  console.error(
                    `[${address}:${port}] remoteConnection!.readable is close`
                  );
                  socket.close();
                },
                abort(reason) {
                  socket.close();
                  console.error(
                    `[${address}:${port}] remoteConnection!.readable abort`,
                    reason
                  );
                },
              })
            )
            .catch((error: any) => {
              socket.close();
              console.error(
                `[${address}:${port}] remoteConnection.readable has error`,
                error
              );
            });
        },
        close() {
          console.log(`[${address}:${port}] websocketStream pipeto is close`);
        },
        abort(reason) {
          console.log(
            `[${address}:${port}] websocketStream pipeto is abort `,
            reason
          );
          remoteConnection?.close();
          socket.close();
        },
      })
    );
  } catch (error: any) {
    console.error(`[${address}:${port}] processSocket`, error);
    socket.close();
  }
  return;
}
