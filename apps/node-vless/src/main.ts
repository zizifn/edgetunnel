import { createServer } from 'http';
import { parse } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { index401, serverStaticFile } from './app/utils';
import * as uuid from 'uuid';
import * as lodash from 'lodash';
import { createReadStream } from 'node:fs';
import {
  makeReadableWebSocketStream,
  processVlessHeader,
  delay,
  closeWebSocket,
} from 'vless-js';
import { connect, Socket } from 'node:net';
import { Duplex, Readable } from 'stream';

const port = process.env.PORT;
const userID = process.env.UUID || '';
let isVaildUser = uuid.validate(userID);
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

vlessWServer.on('connection', async function connection(ws) {
  let address = '';
  let portWithRandomLog = '';
  try {
    const log = (info: string, event?: any) => {
      console.log(`[${address}:${portWithRandomLog}] ${info}`, event || '');
    };
    let remoteConnection: Socket = null;
    let remoteConnectionReadyResolve: Function;

    const readableWebSocketStream = makeReadableWebSocketStream(ws, log);
    let vlessResponseHeader: Uint8Array | null = null;

    // ws --> remote
    readableWebSocketStream
      .pipeTo(
        new WritableStream({
          async write(chunk: Buffer, controller) {
            if (remoteConnection) {
              await socketAsyncWrite(remoteConnection, chunk);
              // remoteConnection.write(chunk);
              return;
            }
            const vlessBuffer = chunk.buffer.slice(chunk.byteOffset);
            const {
              hasError,
              message,
              portRemote,
              addressRemote,
              rawDataIndex,
              vlessVersion,
            } = processVlessHeader(vlessBuffer, userID, uuid, lodash);
            address = addressRemote || '';
            portWithRandomLog = `${portRemote}--${Math.random()}`;
            if (hasError) {
              controller.error(`[${address}:${portWithRandomLog}] ${message} `);
            }
            // const addressType = requestAddr >> 42
            // const addressLength = requestAddr & 0x0f;
            console.log(`[${address}:${portWithRandomLog}] connecting`);
            remoteConnection = await connect2Remote(portRemote, address, log);
            vlessResponseHeader = new Uint8Array([vlessVersion![0], 0]);

            const rawClientData = vlessBuffer.slice(rawDataIndex!);
            remoteConnection.write(new Uint8Array(rawClientData));
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
    // remote --> ws
    let remoteChunkCount = 0;
    let totoal = 0;
    await Readable.toWeb(remoteConnection).pipeTo(
      new WritableStream({
        start() {
          if (ws.readyState === ws.OPEN) {
            ws.send(vlessResponseHeader!);
          }
        },
        async write(chunk: Uint8Array, controller) {
          await wsAsyncWrite(ws, chunk);
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

server.listen(port, () => {
  console.log(`server listen in http://127.0.0.1:${port}`);
});

async function connect2Remote(port, host, log: Function): Promise<Socket> {
  return new Promise((resole, reject) => {
    const remoteSocket = connect(
      {
        port: port,
        host: host,
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

async function socketAsyncWrite(ws: Socket, chunk: Buffer) {
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
