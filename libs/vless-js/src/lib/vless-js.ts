import { stringify } from 'uuid';
export function vlessJs(): string {
  return 'vless-js';
}

export function delay(ms: number) {
  return new Promise((resolve, rej) => {
    setTimeout(resolve, ms);
  });
}

export function makeReadableWebSocketStream(
  ws: WebSocket | any,
  earlyDataHeader: string,
  log: Function
) {
  let readableStreamCancel = false;
  return new ReadableStream<ArrayBuffer>({
    start(controller) {
      ws.addEventListener('message', async (e: { data: ArrayBuffer }) => {
        // is stream is cancel, skip controller.enqueue
        if (readableStreamCancel) {
          return;
        }
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
          // is stream is cancel, skip controller.close
          if (readableStreamCancel) {
            return;
          }
          controller.close();
        } catch (error) {
          log(`websocketStream can't close DUE to `, error);
        }
      });
      // header ws 0rtt
      const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
      if (error) {
        log(`earlyDataHeader has invaild base64`);
        closeWebSocket(ws);
        return;
      }
      if (earlyData) {
        controller.enqueue(earlyData);
      }
    },
    pull(controller) {
      // if ws can stop read if stream is full, we can implement backpressure
      // https://streams.spec.whatwg.org/#example-rs-push-backpressure
    },
    cancel(reason) {
      // TODO: log can be remove, if writestream has error, write stream will has log
      log(`websocketStream is cancel DUE to `, reason);
      if (readableStreamCancel) {
        return;
      }
      readableStreamCancel = true;
      closeWebSocket(ws);
    },
  });
}

function base64ToArrayBuffer(base64Str: string) {
  if (!base64Str) {
    return { error: null };
  }
  try {
    // go use modified Base64 for URL rfc4648 which js atob not support
    base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
    const decode = atob(base64Str);
    const arryBuffer = Uint8Array.from(decode, (c) => c.charCodeAt(0));
    return { earlyData: arryBuffer.buffer, error: null };
  } catch (error) {
    return { error };
  }
}

export function closeWebSocket(socket: WebSocket | any) {
  if (socket.readyState === socket.OPEN) {
    socket.close();
  }
}

//https://github.com/v2ray/v2ray-core/issues/2636
// 1 字节	  16 字节       1 字节	       M 字节	              1 字节            2 字节      1 字节	      S 字节	      X 字节
// 协议版本	  等价 UUID	  附加信息长度 M	(附加信息 ProtoBuf)  指令(udp/tcp)	    端口	      地址类型      地址	        请求数据
// 00                   00                                  01                 01bb(443)   02(ip/host)
// 1 字节	              1 字节	      N 字节	         Y 字节
// 协议版本，与请求的一致	附加信息长度 N	附加信息 ProtoBuf	响应数据
export function processVlessHeader(
  vlessBuffer: ArrayBuffer,
  userID: string
  // uuidLib: any,
  // lodash: any
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
  if (stringify(new Uint8Array(vlessBuffer.slice(1, 17))) === userID) {
    isValidUser = true;
  }
  if (!isValidUser) {
    // console.log('in valid user');
    // controller.error('in valid user');
    return {
      hasError: true,
      message: 'invalid user',
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
      const dataView = new DataView(
        vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
      );
      // 2001:0db8:85a3:0000:0000:8a2e:0370:7334
      const ipv6 = [];
      for (let i = 0; i < 8; i++) {
        ipv6.push(dataView.getUint16(i * 2).toString(16));
      }
      addressValue = ipv6.join(':');
      // console.log('---------', addressValue)
      // seems no need add [] for ipv6
      // if (addressValue) {
      //   addressValue = `[${addressValue}]`;
      // }
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
