import { createServer } from 'http';
import { parse } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { index401, serverStaticFile } from './app/utils';
import { validate } from 'uuid';
import { createReadStream } from 'node:fs';
import { setDefaultResultOrder } from 'node:dns';
import { createSocket, Socket as UDPSocket } from 'node:dgram';

import {
  makeReadableWebSocketStream,
  processVlessHeader,
  delay,
  closeWebSocket,
} from 'vless-js';
import { connect, Socket } from 'node:net';
import { Duplex, Readable } from 'stream';
import {
  TransformStream,
  ReadableStream,
  WritableStream,
} from 'node:stream/web';
const port = process.env.PORT;
const userID = process.env.UUID || '';
//'ipv4first' or 'verbatim'
const dnOder = process.env.DNSORDER || 'verbatim';
if (dnOder === 'ipv4first') {
  setDefaultResultOrder(dnOder);
}

let isVaildUser = validate(userID);
if (!isVaildUser) {
  console.log('not set valid UUID');
}

const server = createServer((req, resp) => {
  if (!isVaildUser) {
    return index401(req, resp);
  }
  const url = new URL(req.url, `http://${req.headers['host']}`);
  // health check
  if (req.method === 'GET' && url.pathname.startsWith('/health')) {
    resp.writeHead(200);
    resp.write('health 200');
    resp.end();
    return;
  }

  // index page
  if (url.pathname.includes(userID)) {
    const index = 'dist/apps/cf-page/index.html';
    resp.writeHead(200, {
      'Content-Type': 'text/html,charset=UTF-8',
    });
    return createReadStream(index).pipe(resp);
  }
  if (req.method === 'GET' && url.pathname.startsWith('/assets')) {
    return serverStaticFile(req, resp);
  }

  const basicAuth = req.headers.authorization || '';
  const authStringBase64 = basicAuth.split(' ')?.[1] || '';
  const authString = Buffer.from(authStringBase64, 'base64').toString('ascii');
  if (authString && authString.includes(userID)) {
    resp.writeHead(302, {
      'content-type': 'text/html; charset=utf-8',
      Location: `./${userID}`,
    });
    resp.end();
  } else {
    resp.writeHead(401, {
      'content-type': 'text/html; charset=utf-8',
      'WWW-Authenticate': 'Basic',
    });
    resp.end();
  }
});
const vlessWServer = new WebSocketServer({ noServer: true });

vlessWServer.on('connection', async function connection(ws, request) {
  let address = '';
  let portWithRandomLog = '';
  try {
    const log = (info: string, event?: any) => {
      console.log(`[${address}:${portWithRandomLog}] ${info}`, event || '');
    };
    let remoteConnection: Duplex = null;
    let udpClientStream: TransformStream = null;
    let remoteConnectionReadyResolve: Function;
    const earlyDataHeader = request.headers['sec-websocket-protocol'];
    const readableWebSocketStream = makeReadableWebSocketStream(
      ws,
      earlyDataHeader,
      log
    );
    let vlessResponseHeader: Uint8Array | null = null;

    // ws  --> remote
    readableWebSocketStream
      .pipeTo(
        new WritableStream({
          async write(chunk: Buffer, controller) {
            if (!Buffer.isBuffer(chunk)) {
              chunk = Buffer.from(chunk);
            }
            if (udpClientStream) {
              const writer = udpClientStream.writable.getWriter();
              // nodejs buffer to ArrayBuffer issue
              // https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#bufbuffer
              await writer.write(
                chunk.buffer.slice(
                  chunk.byteOffset,
                  chunk.byteOffset + chunk.length
                )
              );
              writer.releaseLock();
              return;
            }
            if (remoteConnection) {
              await socketAsyncWrite(remoteConnection, chunk);
              // remoteConnection.write(chunk);
              return;
            }
            const vlessBuffer = chunk.buffer.slice(
              chunk.byteOffset,
              chunk.byteOffset + chunk.length
            );
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
            if (hasError) {
              controller.error(`[${address}:${portWithRandomLog}] ${message} `);
            }
            // const addressType = requestAddr >> 42
            // const addressLength = requestAddr & 0x0f;
            console.log(`[${address}:${portWithRandomLog}] connecting`);
            vlessResponseHeader = new Uint8Array([vlessVersion![0], 0]);
            const rawClientData = vlessBuffer.slice(rawDataIndex!);
            if (isUDP) {
              udpClientStream = makeUDPSocketStream(portRemote, address);
              const writer = udpClientStream.writable.getWriter();
              writer.write(rawClientData).catch(error=>console.log)
              writer.releaseLock();
              remoteConnectionReadyResolve(udpClientStream);
            } else {
              remoteConnection = await connect2Remote(portRemote, address, log);
              remoteConnection.write(new Uint8Array(rawClientData));
              remoteConnectionReadyResolve(remoteConnection);
            }
          },
          close() {
            // if (udpClientStream ) {
            //   udpClientStream.writable.close();
            // }
            console.log(
              `[${address}:${portWithRandomLog}] readableWebSocketStream is close`
            );
          },
          abort(reason) {
            // TODO: log can be remove, abort will catch by catch block
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
    // remote --> ws
    let responseStream = udpClientStream?.readable;
    if (remoteConnection) {
      responseStream = Readable.toWeb(remoteConnection);
    }

    // if readable not pipe can't wait fro writeable write method
    await responseStream.pipeTo(
      new WritableStream({
        start() {
          if (ws.readyState === ws.OPEN) {
            ws.send(vlessResponseHeader!);
          }
        },
        async write(chunk: Uint8Array, controller) {
          // console.log('ws write', chunk);
          if (ws.readyState === ws.OPEN) {
            await wsAsyncWrite(ws, chunk);
          }
        },
        close() {
          console.log(
            `[${address}:${portWithRandomLog}] remoteConnection!.readable is close`
          );
        },
        abort(reason) {
          closeWebSocket(ws);
          console.error(
            `[${address}:${portWithRandomLog}] remoteConnection!.readable abort`,
            reason
          );
        },
      })
    );
  } catch (error) {
    console.error(
      `[${address}:${portWithRandomLog}] processWebSocket has exception `,
      error.stack || error
    );
    closeWebSocket(ws);
  }
});

server.on('upgrade', function upgrade(request, socket, head) {
  const { pathname } = parse(request.url);

  vlessWServer.handleUpgrade(request, socket, head, function done(ws) {
    vlessWServer.emit('connection', ws, request);
  });
});

server.listen(
  {
    port: port,
    host: '0.0.0.0',
  },
  () => {
    console.log(`server listen in http://127.0.0.1:${port}`);
  }
);

async function connect2Remote(port, host, log: Function): Promise<Socket> {
  return new Promise((resole, reject) => {
    const remoteSocket = connect(
      {
        port: port,
        host: host,
        // https://github.com/nodejs/node/pull/46587
        // autoSelectFamily: true,
      },
      () => {
        log(`connected`);
        resole(remoteSocket);
      }
    );
    remoteSocket.addListener('error', () => {
      reject('remoteSocket has error');
    });
  });
}

async function socketAsyncWrite(ws: Duplex, chunk: Buffer) {
  return new Promise((resolve, reject) => {
    ws.write(chunk, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve('');
      }
    });
  });
}

async function wsAsyncWrite(ws: WebSocket, chunk: Uint8Array) {
  return new Promise((resolve, reject) => {
    ws.send(chunk, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve('');
      }
    });
  });
}

function makeUDPSocketStream(portRemote, address) {
  const udpClient = createSocket('udp4');
  const transformStream = new TransformStream({
    start(controller) {
      /* … */
      udpClient.on('message', (message, info) => {
        controller.enqueue(
          Buffer.concat([new Uint8Array([0, info.size]), message])
        );
      });
      udpClient.on('error', (error) => {
        console.log('udpClient error event', error);
        controller.error(error);
      });
    },

    async transform(chunk: ArrayBuffer, controller) {
      //seems v2ray will use same web socket for dns query..
      //And v2ray will combine A record and AAAA record into one ws message and use 2 btye for dns query length
      for (let index = 0; index < chunk.byteLength; ) {
        const lengthBuffer = chunk.slice(index, index + 2);
        const udpPakcetLength = new DataView(lengthBuffer).getInt16(0);
        const udpData = new Uint8Array(
          chunk.slice(index + 2, index + 2 + udpPakcetLength)
        );
        index = index + 2 + udpPakcetLength;
       await new Promise((resolve, reject)=>{
        udpClient.send(udpData, portRemote, address, (err) => {
          if (err) {
            console.log('udps send error', err);
            controller.error(`Failed to send UDP packet !! ${err}`);
            safeCloseUDP(udpClient);
          }
          resolve(true)
        });
       })
        index = index;
      }

      // console.log('dns chunk', chunk);
      // console.log(portRemote, address);
      // port is big-Endian in raw data etc 80 == 0x005d
    },

    flush(controller) {
      safeCloseUDP(udpClient);
      controller.terminate();
    },
  });
  return transformStream;
}


function safeCloseUDP(client: UDPSocket){
  try{
    client.close()
  }catch(error){
    console.log('error close udp', error);
  }

}