import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { config } from './lib/cmd';
import * as url from 'node:url';
import * as undici from 'undici';
import { concatStreams, rawHTTPPackage } from './lib/helper';

const httpProxyServer = createServer(async (req, resp) => {
  const reqUrl = url.parse(req.url);
  const clientSocketLoggerInfo = `[proxy to ${req.url}(http)]`;
  try {
    console.log(
      `Client Connected To Proxy, client http version is ${req.httpVersion}, ${clientSocketLoggerInfo}}`
    );

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
        body: Readable.from(concatStreams([rawHTTPPackage(req), req.socket])),
      }
    );
    console.log(`${clientSocketLoggerInfo} remote server return ${statusCode}`);
    // 2. forward remote reponse body to clientSocket
    for await (const chunk of body) {
      req.socket.write(chunk);
    }
    body.on('error', (err) => {
      console.log(
        `${clientSocketLoggerInfo} remote server response body has error`,
        err
      );
    });
    // issue with pipeline
    // https://stackoverflow.com/questions/55959479/error-err-stream-premature-close-premature-close-in-node-pipeline-stream
    // pipeline(body, req.socket, (error) => {
    //   console.log(
    //     `${clientSocketLoggerInfo} remote server to clientSocket has error: ` +
    //       error
    //   );
    //   req.socket.end();
    //   req.socket.destroy();
    // });
  } catch (error) {
    req.socket.end();
    req.socket.destroy();
    console.log(`${clientSocketLoggerInfo} has error `, error);
  }
});

// handle https website
httpProxyServer.on('connect', async (req, clientSocket, head) => {
  const reqUrl = url.parse('https://' + req.url);
  const clientSocketLoggerInfo = `[proxy to ${req.url}]`;
  try {
    console.log(
      `${clientSocketLoggerInfo} Client use HTTP/${
        req.httpVersion
      } Connected To Proxy, head on connect is ${head.toString() || 'empty'}`
    );
    // We need only the data once, the starting packet, per http proxy spec
    clientSocket.write(
      `HTTP/${req.httpVersion} 200 Connection Established\r\n\r\n`
    );

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
    // 2. forward remote reponse body to clientSocket
    for await (const chunk of body) {
      clientSocket.write(chunk);
    }
    body.on('error', (err) => {
      console.log(`${clientSocketLoggerInfo} body error`, err);
    });
    // pipeline(body, clientSocket, (error) => {
    //   console.log(
    //     `${clientSocketLoggerInfo} remote server to clientSocket has error: `,
    //     error
    //   );
    //   body?.destroy();
    //   clientSocket.destroy();
    // });
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
