export function vlessJs(): string {
  return 'vless-js';
}

export function delay(ms: number) {
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
            const {
              hasError,
              message,
              portRemote,
              addressRemote,
              rawDataIndex,
              vlessVersion,
              isUDP,
            } = processVlessHeader(vlessBuffer, userID, uuid, lodash);
            address = addressRemote || '';
            portWithRandomLog = `${portRemote}--${Math.random()}`;
            if (isUDP) {
              controller.error(
                `[${address}:${portWithRandomLog}] command udp is not support `
              );
            }
            if (hasError) {
              controller.error(`[${address}:${portWithRandomLog}] ${message} `);
            }
            // const addressType = requestAddr >> 4;
            // const addressLength = requestAddr & 0x0f;
            console.log(`[${address}:${portWithRandomLog}] connecting`);
            remoteConnection = await rawTCPFactory(portRemote!, address!);
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
        // closeWebSocket(webSocket);
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
          closeWebSocket(webSocket);
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
    closeWebSocket(webSocket);
  }
  return;
}

export function makeReadableWebSocketStream(
  ws: WebSocket | any,
  log: Function
) {
  let readableStreamCancel = false;
  return new ReadableStream<ArrayBuffer>({
    start(controller) {
      ws.addEventListener('message', async (e: { data: ArrayBuffer }) => {
        // console.log('MESSAGE');
        const vlessBuffer: ArrayBuffer = e.data;
        // console.log('MESSAGE', vlessBuffer);

        // console.log(`message is ${vlessBuffer.byteLength}`);
        // this is not backpressure, but backpressure is depends on underying websocket can pasue
        // https://streams.spec.whatwg.org/#example-rs-push-backpressure
        controller.enqueue(vlessBuffer);
      });
      ws.addEventListener('error', (e: any) => {
        log('socket has error');
        readableStreamCancel = true;
        controller.error(e);
      });
      ws.addEventListener('close', () => {
        try {
          log('webSocket is close');
          // is stream is cancel, skill controller.close
          if (readableStreamCancel) {
            return;
          }
          controller.close();
        } catch (error) {
          log(`websocketStream can't close DUE to `, error);
        }
      });
    },
    pull(controller) {},
    cancel(reason) {
      log(`websocketStream is cancel DUE to `, reason);
      if (readableStreamCancel) {
        return;
      }
      readableStreamCancel = true;
      closeWebSocket(ws);
    },
  });
}

export function closeWebSocket(socket: WebSocket | any) {
  if (socket.readyState === socket.OPEN) {
    socket.close();
  }
}

//https://github.com/v2ray/v2ray-core/issues/2636
// 1 字节	  16 字节     1 字节	       M 字节	      1 字节  2 字节   1 字节	 S 字节	X 字节
// 协议版本	  等价 UUID	  附加信息长度 M	附加信息 ProtoBuf  指令	    端口	地址类型   地址	请求数据

// 1 字节	              1 字节	      N 字节	         Y 字节
// 协议版本，与请求的一致	附加信息长度 N	附加信息 ProtoBuf	响应数据
export function processVlessHeader(
  vlessBuffer: ArrayBuffer,
  userID: string,
  uuidLib: any,
  lodash: any
) {
  if (vlessBuffer.byteLength < 24) {
    // console.log('invalid data');
    // controller.error('invalid data');
    return {
      hasError: true,
      message: 'invalid data',
    };
  }
  const version = new Uint8Array(vlessBuffer.slice(0, 1));
  let isValidUser = false;
  let isUDP = false;
  if (uuidLib.stringify(new Uint8Array(vlessBuffer.slice(1, 17))) === userID) {
    isValidUser = true;
  }
  if (!isValidUser) {
    // console.log('in valid user');
    // controller.error('in valid user');
    return {
      hasError: true,
      message: 'in valid user',
    };
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
  } else if (command === 2) {
    isUDP = true;
  } else {
    return {
      hasError: true,
      message: `command ${command} is not support, command 01-tcp,02-udp,03-mux`,
    };
  }
  const portIndex = 18 + optLength + 1;
  const portBuffer = vlessBuffer.slice(portIndex, portIndex + 2);
  // port is big-Endian in raw data etc 80 == 0x005d
  const portRemote = new DataView(portBuffer).getInt16(0);

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
        vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
      ).join('.');
      break;
    case 2:
      addressLength = new Uint8Array(
        vlessBuffer.slice(addressValueIndex, addressValueIndex + 1)
      )[0];
      addressValueIndex += 1;
      addressValue = new TextDecoder().decode(
        vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
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
          items.map((item) => item.toString(16).padStart(2, '0')).join('')
        )
        .join(':');
      if (addressValue) {
        addressValue = `[${addressValue}]`;
      }

      break;
    default:
      console.log(`invild  addressType is ${addressType}`);
  }
  if (!addressValue) {
    // console.log(`[${address}:${port}] addressValue is empty`);
    // controller.error(`[${address}:${portWithRandomLog}] addressValue is empty`);
    return {
      hasError: true,
      message: `addressValue is empty, addressType is ${addressType}`,
    };
  }

  return {
    hasError: false,
    addressRemote: addressValue,
    portRemote,
    rawDataIndex: addressValueIndex + addressLength,
    vlessVersion: version,
    isUDP,
  };
}
