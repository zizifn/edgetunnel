import { Socket } from 'node:net';
import { createServer } from 'node:http';
import { Duplex, pipeline, Readable } from 'node:stream';
import { fetch } from 'undici';
import { ReadableStream, WritableStream } from 'node:stream/web';
import { Command } from 'commander';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { exit } from 'node:process';
import { config } from './lib/cmd';
import * as url from 'node:url';
import * as undici from 'undici';
import { concatStreams, rawHTTPHeader, rawHTTPPackage } from './lib/helper';

const httpProxyServer = createServer(async (req, resp) => {
  const reqUrl = url.parse(req.url);
  const clientSocketLoggerInfo = `[proxy to ${req.url}(http)]`;
  try {
    console.log(
      `Client Connected To Proxy, client http version is ${req.httpVersion}, ${clientSocketLoggerInfo}}`
    );

    const raws = rawHTTPPackage(req);
    const readableStream = new Readable({
      async read() {
        const { value, done } = await raws.next();
        if (!done) {
          this.push(value);
        }
      },
      destroy() {
        this.push(null);
      },
    });

    // make call to edge http server
    // 1. forward all package remote, socket over http body
    const { body, headers, statusCode, trailers } = await undici.request(
      config.address,
      {
        headers: {
          'x-host': reqUrl.hostname,
          'x-port': reqUrl.port || '80',
          'x-uuid': config.uuid,
          // "Content-Type": "text/plain",
        },
        method: 'POST',
        // body: Readable.from(rawHTTPPackage(req)),
        body: readableStream,

        // body: rawHTTPHeader(req),
        // body: req,
      }
    );
    // for await (const item of rawHTTPPackage(req)) {
    //   myReadable.push(item);
    // }
    // console.log(headers, statusCode);
    // for await (let chunk of body) {
    //   console.log(chunk.toString());
    // }
    // 2. forward remote reponse body to clientSocket

    pipeline(body, resp, (error) => {
      console.log(
        `${clientSocketLoggerInfo} remote server to clientSocket has error: ` +
          error
      );
      resp.destroy();
    });
    body.on('error', (err) => {
      console.log('body error', err);
    });
    body.on('data', () => {
      if (!readableStream.closed) {
        readableStream.push(null);
      }
    });
  } catch (error) {
    resp.destroy();
    console.log('${clientSocketLogger} has error ', error);
  }
});

// handle https website
httpProxyServer.on('connect', async (req, clientSocket, head) => {
  const reqUrl = url.parse('https://' + req.url);
  const clientSocketLoggerInfo = `[proxy to ${req.url}]`;
  try {
    console.log(
      `Client Connected To Proxy, client http version is ${
        req.httpVersion
      }, ${clientSocketLoggerInfo}, head is ${head.toString()}`
    );
    // We need only the data once, the starting packet, per http proxy spec
    clientSocket.write(
      `HTTP/${req.httpVersion} 200 Connection Established\r\n\r\n`
    );

    console.log(config);
    // make call to edge http server
    // 1. forward all package remote, socket over http body
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
        body: Readable.from(concatStreams([head, clientSocket])),
      }
    );
    console.log(`${clientSocketLoggerInfo} remote server return ${statusCode}`);
    // 2. forward remote reponse body to clientSocket
    pipeline(body, clientSocket, (error) => {
      console.log(
        `${clientSocketLoggerInfo} remote server to clientSocket has error: `,
        error
      );
      body?.destroy();
      clientSocket.destroy();
    });
    clientSocket.on('error', (e) => {
      body?.destroy();
      clientSocket.destroy();
      console.log(`${clientSocketLoggerInfo} clientSocket has error: ` + e);
    });
    clientSocket.on('end', () => {
      console.log(`${clientSocketLoggerInfo} has done and end.`);
    });
  } catch (error) {
    clientSocket.destroy();
    console.log(`${clientSocketLoggerInfo} has error `, error);
  }
});

httpProxyServer.on('error', (err) => {
  console.log('SERVER ERROR');
  console.log(err);
  throw err;
});
httpProxyServer.on('clientError', (err, clientSocket) => {
  console.log('client error: ' + err);
  clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

httpProxyServer.on('close', () => {
  console.log('Client Disconnected');
});

httpProxyServer.listen(Number(config.port), () => {
  console.log('Server runnig at http://localhost:' + config.port);
});
