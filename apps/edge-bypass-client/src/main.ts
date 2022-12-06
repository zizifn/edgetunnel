import { createServer } from 'node:http';
import { pipeline, Readable } from 'node:stream';
import { config } from './lib/cmd';
import * as url from 'node:url';
import * as undici from 'undici';
import {
  concatStreams,
  rawHTTPPackage,
  errorHandler,
  loghelper,
} from './lib/helper';

errorHandler();

const isLocal = process.env.DEBUG === 'true';
const httpProxyServer = createServer(async (req, resp) => {
  const reqUrl = url.parse(req.url);
  const clientSocketLoggerInfo = `[proxy to ${req.url}](http)`;
  try {
    loghelper(`${clientSocketLoggerInfo} Client use HTTP/${req.httpVersion}`);
    // make call to edge http server
    // 1. forward all package remote, socket over http body
    const fromClientReq = Readable.from(rawHTTPPackage(req)).on(
      'error',
      (error) => {
        loghelper(
          `${clientSocketLoggerInfo} client socket to remote http body has error`,
          error
        );
        req.destroy();
      }
    );
    const { body, headers, statusCode, trailers } = await undici.request(
      config.address,
      {
        headers: {
          'x-host': reqUrl.hostname,
          'x-port': reqUrl.port || '80',
          'x-uuid': config.uuid,
          'x-http': 'true',
        },
        method: 'POST',
        body: fromClientReq,
      }
    );
    loghelper(
      `${clientSocketLoggerInfo} remote server return ${statusCode} Connected To Proxy`
    );
    // 2. forward remote reponse body to clientSocket
    for await (const chunk of body) {
      if (isLocal) {
        loghelper(chunk.toString());
      }
      req.socket.write(chunk);
      // resp.write(chunk);
    }
    // resp.end();
    body.on('error', (err) => {
      loghelper(
        `${clientSocketLoggerInfo} remote server response body has error`,
        err
      );
      req.destroy();
    });
  } catch (error) {
    req.destroy();
    req.socket?.end();
    loghelper(`${clientSocketLoggerInfo} has error `, error);
  }
});

// handle https website
httpProxyServer.on('connect', async (req, clientSocket, head) => {
  const reqUrl = url.parse('https://' + req.url);
  const clientSocketLoggerInfo = `[proxy to ${req.url}]`;
  let fromClientSocket = null;
  try {
    loghelper(
      `${clientSocketLoggerInfo} Client use HTTP/${
        req.httpVersion
      } Connected To Proxy, head on connect is ${head.toString() || 'empty'}`
    );
    // We need only the data once, the starting packet, per http proxy spec
    clientSocket.write(
      `HTTP/${req.httpVersion} 200 Connection Established\r\n\r\n`
    );

    // loghelper(config);
    // make call to edge http server
    // 1. forward all package remote, socket over http body
    fromClientSocket = Readable.from(concatStreams([head, clientSocket]));
    const { body, headers, statusCode, trailers } = await undici.request(
      config.address,
      {
        headers: {
          'x-host': reqUrl.hostname,
          'x-port': reqUrl.port,
          'x-uuid': config.uuid,
          // "Content-Type": "text/plain",
        },
        method: 'POST',
        body: fromClientSocket,
      }
    );
    fromClientSocket.on('error', (error) => {
      loghelper(
        `${clientSocketLoggerInfo} client socket to remote http body has error`,
        error
      );
      //
      fromClientSocket.push(null);
      clientSocket.destroy();
    });
    loghelper(`${clientSocketLoggerInfo} remote server return ${statusCode}`);
    // 2. forward remote reponse body to clientSocket
    for await (const chunk of body) {
      clientSocket.write(chunk);
    }

    body.on('error', (err) => {
      loghelper(
        `${clientSocketLoggerInfo} remote response body has error`,
        err
      );
      fromClientSocket.push(null);
      clientSocket.destroy();
    });
    clientSocket.on('error', (e) => {
      body?.destroy();
      fromClientSocket.push(null);
      clientSocket.end();
      loghelper(`${clientSocketLoggerInfo} clientSocket has error: ` + e);
    });
    clientSocket.on('end', () => {
      loghelper(`${clientSocketLoggerInfo} has done and end.`);
    });
  } catch (error) {
    fromClientSocket?.push(null);
    clientSocket.end();
    loghelper(`${clientSocketLoggerInfo} has error `, error);
  }
});

httpProxyServer.on('error', (err) => {
  loghelper('SERVER ERROR', err);
});
httpProxyServer.on('clientError', (err, clientSocket) => {
  loghelper('client error: ' + err);
  clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

httpProxyServer.on('close', () => {
  loghelper('Server close');
});

httpProxyServer.listen(Number(config.port), () => {
  loghelper('Server runnig at http://localhost:' + config.port);
});
