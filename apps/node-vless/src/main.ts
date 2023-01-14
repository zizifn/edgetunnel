import { createServer } from 'http';
import { parse } from 'url';
import { WebSocketServer } from 'ws';
import { index401, serverStaticFile } from './app/utils';
import * as uuid from 'uuid';
import * as lodash from 'lodash';
import { createReadStream } from 'node:fs';
import {
  makeReadableWebSocketStream,
  processVlessHeader,
  delay,
} from 'vless-js';
import { connect, Socket } from 'node:net';
import { networkInterfaces } from 'os';

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
  // index page
  if (url.pathname.includes(userID)) {
    const index = 'dist/apps/cf-page/index.html';
    return createReadStream(index).pipe(resp);
  }
  if (req.method === 'GET' && url.pathname.startsWith('/assets')) {
    return serverStaticFile(req, resp);
  }

  const basicAuth = req.headers.authorization || '';
  const authStringBase64 = basicAuth.split(' ')?.[1] || '';
  const authString = Buffer.from(authStringBase64, 'base64').toString('ascii');
  console.log('-----authString--', authString);
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

vlessWServer.on('connection', function connection(ws) {
  let address = '';
  let portWithRandomLog = '';
  const log = (info: string, event?: any) => {
    console.log(`[${address}:${portWithRandomLog}] ${info}`, event || '');
  };
  let remoteConnection: Socket | null = null;
  const readableWebSocketStream = makeReadableWebSocketStream(ws, log);
  // ws --> remote
  readableWebSocketStream.pipeTo(
    new WritableStream({
      async write(chunk, controller) {
        const vlessBuffer = chunk;
        if (!remoteConnection.closed) {
          const number = remoteConnection.write(new Uint8Array(vlessBuffer));
          return;
        }
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
        // const addressType = requestAddr >> 4;
        // const addressLength = requestAddr & 0x0f;
        console.log(`[${address}:${portWithRandomLog}] connecting`);
        remoteConnection = connect(
          {
            port: portRemote,
            host: address,
          },
          () => {
            console.log(`[${address}:${portWithRandomLog}] connected`);
          }
        );
        const rawClientData = vlessBuffer.slice(rawDataIndex!);
        remoteConnection.write(new Uint8Array(rawClientData));
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
});

server.on('upgrade', function upgrade(request, socket, head) {
  console.log('upgrade');
  const { pathname } = parse(request.url);

  if (pathname === '/foo') {
    vlessWServer.handleUpgrade(request, socket, head, function done(ws) {
      vlessWServer.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, () => {
  console.log(`server listen in http://127.0.0.1:${port}`);
});
