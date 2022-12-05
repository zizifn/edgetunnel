import { IncomingMessage } from 'http';
import * as os from 'os';
import * as url from 'node:url';

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

export {
  concatStreams,
  rawHTTPPackage,
  rawHTTPHeader,
  rawHTTPPackageWithDelay,
};
