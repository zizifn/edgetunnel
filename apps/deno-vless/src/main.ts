import { serve } from 'https://deno.land/std@0.167.0/http/server.ts';
import { parse, stringify, validate } from 'npm:uuid@^9.0.0';
const userID = Deno.env.get('UUID');

if (!validate(userID)) {
  console.log('not valid userID');
}

const handler = async (req: Request): Promise<Response> => {
  const upgrade = req.headers.get('upgrade') || '';
  if (upgrade.toLowerCase() != 'websocket') {
    return new Response("request isn't trying to upgrade to websocket.");
  }
  console.log('---upgradeWebSocket---');
  const { socket, response } = Deno.upgradeWebSocket(req);
  let remoteConnection: Deno.TcpConn;
  let skipHeader = false;
  socket.onopen = () => console.log('socket opened');
  //   socket.onmessage = async (e) => {
  //     socket.send('11111');
  //     socket.send('11111');
  //   };
  socket.onmessage = async (e) => {
    const vlessBuffer: ArrayBuffer = e.data;
    console.log('---onmessage');
    if (remoteConnection) {
      console.log(vlessBuffer);
      skipHeader = true;
      const number = await remoteConnection.write(new Uint8Array(vlessBuffer));
      console.log(number);
    } else {
      //https://github.com/v2ray/v2ray-core/issues/2636
      // 1 字节	  16 字节     1 字节	       M 字节	      1 字节  2 字节   1 字节	 S 字节	X 字节
      // 协议版本	  等价 UUID	  附加信息长度 M	附加信息 ProtoBuf  指令	    端口	地址类型   地址	请求数据

      //
      // 1 字节	              1 字节	      N 字节	         Y 字节
      // 协议版本，与请求的一致	附加信息长度 N	附加信息 ProtoBuf	响应数据
      if (vlessBuffer.byteLength < 24) {
        console.log('invalid data');
        return;
      }
      const version = new Uint8Array(vlessBuffer.slice(0, 1));
      let isValidUser = false;
      if (stringify(new Uint8Array(vlessBuffer.slice(1, 17))) === userID) {
        isValidUser = true;
      }
      if (!isValidUser) {
        console.log('valid user');
        return;
      }

      const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
      //skip opt for now

      const command = new Uint8Array(
        vlessBuffer.slice(18 + optLength, 18 + optLength + 1)
      )[0];
      if (command === 1) {
        console.log('-----tcp---');
      }
      const portIndex = 18 + optLength + 1;
      const portBuffer = vlessBuffer.slice(portIndex, portIndex + 2);
      // port is big-Endian in raw data etc 80 == 0x005d
      const port = new DataView(portBuffer).getInt16(0);
      console.log(port);
      const addressIndex = portIndex + 2;
      // 1 byte =  0000(domain/ip/ect) 0000 (length)
      const addressBuffer = new Uint8Array(
        vlessBuffer.slice(addressIndex, addressIndex + 2)
      );
      const addressType = addressBuffer[0];
      const addressLength = addressBuffer[1];
      // const addressType = requestAddr >> 4;
      // const addressLength = requestAddr & 0x0f;

      const addressValueIndex = addressIndex + 2;
      const addressValue = new TextDecoder().decode(
        vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
      );
      console.log('address', addressType, addressLength, addressValue);

      remoteConnection = await Deno.connect({
        port: port,
        hostname: addressValue,
      });

      const rawDataIndex = addressValueIndex + addressLength;
      const rawClientData = vlessBuffer.slice(rawDataIndex);
      await remoteConnection.write(new Uint8Array(rawClientData));

      const rerquestHeader = {
        version: version,
        uuid: '', //e2839021-2313-427f-977c-a1b1dec79ace
      };
      let chunkDatas = [new Uint8Array([version[0], 0])];
      let i = 0;
      //   for await (const chunk of remoteConnection.readable) {
      //     console.log('remote return data');
      //     chunkDatas.push(chunk);
      //   }
      //   console.log(chunkDatas);
      //   socket.send(new Blob(chunkDatas));
      remoteConnection.readable.pipeTo(
        new WritableStream({
          write(chunk, controller) {
            if (!skipHeader) {
              console.log('first time write to client socket');
              chunkDatas.push(chunk);
              socket.send(new Blob(chunkDatas));
              chunkDatas = [];
            } else {
              socket.send(new Blob([chunk]));
              console.log(`${i} time write to client socket1`);
            }
            i++;
          },
        })
      );

      console.log('end');
    }
  };
  socket.onerror = (e) => console.log('socket errored:', e);
  socket.onclose = () => console.log('socket closed');
  return response;
};

serve(handler, { port: 8080, hostname: '0.0.0.0' });
