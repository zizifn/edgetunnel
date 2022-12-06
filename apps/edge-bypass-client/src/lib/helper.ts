import { IncomingMessage } from 'http';
import * as os from 'os';
import * as url from 'node:url';
import { config } from './cmd';

async function* concatStreams(readables: any[]) {
  for (const readable of readables) {
    for await (const chunk of readable) {
      yield chunk;
    }
  }
}

// POST http://zizi.press/test11.ttt?test1=66 HTTP/1.1
// Host: zizi.press
// User-Agent: curl/7.83.1
// Connection: Keep-Alive
// Content-Type: application/json
// Accept: application/json
// Content-Length: 16

// {"tool": "curl"}

//-------------------------------------
// GET http://zizi.press/test11.ttt?test1=66 HTTP/1.1
// Host: zizi.press
// User-Agent: curl/7.83.1
// Accept: */*
// Connection: Keep-Alive

function rawHTTPHeader(req: IncomingMessage) {
  const reqUrl = url.parse(req.url);
  const headers = Object.entries(req.headers)
    .map(([key, value]) => {
      return `${key}:${value}`;
    })
    .join(os.EOL);
  const raw = `${req.method} ${reqUrl.path} HTTP/${req.httpVersion}${os.EOL}${headers}${os.EOL}${os.EOL}`;
  return raw;
}

function rawHTTPPackage(req: IncomingMessage) {
  const rawHttpHeader = rawHTTPHeader(req);
  return concatStreams([[rawHttpHeader], req]);
}

async function* deplay(ms) {
  yield await new Promise((res, reject) => {
    setTimeout(() => res(''), ms);
  });
}

// delay few ms for
//  // request.body readablestream end casue socket to be end, this will casue socket send FIN package early
// and casue deno can't get TCP pcakge.
function rawHTTPPackageWithDelay(req: IncomingMessage) {
  const rawHttpHeader = rawHTTPHeader(req);
  return concatStreams([[rawHttpHeader], req, deplay(500)]);
}

function errorHandler() {
  process
    .on('unhandledRejection', (reason, p) => {
      console.error(reason, 'Unhandled Rejection at Promise', p);
    })
    .on('uncaughtException', (err) => {
      console.error(err, 'Uncaught Exception thrown');
      // should exit node.js, but anyway
      // process.exit(1);
    });
}

function loghelper(...args) {
  let logs = args;
  if (config.logLevel?.toUpperCase() !== 'DEBUG') {
    logs = args.map((item) => {
      if (item instanceof Error) {
        return `${item.message}`;
      } else {
        return item;
      }
    });
  }
  console.log('', ...logs);
}

export {
  concatStreams,
  rawHTTPPackage,
  rawHTTPHeader,
  rawHTTPPackageWithDelay,
  errorHandler,
  loghelper,
};
