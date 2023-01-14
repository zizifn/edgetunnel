import { createReadStream, existsSync } from 'node:fs';
import { IncomingMessage, ServerResponse } from 'node:http';
import { resolve, join, extname } from 'node:path';
import { cacheHeader } from 'pretty-cache-header';

const mimeLookup = {
  '.js': 'application/javascript,charset=UTF-8',
  '.html': 'text/html,charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
};
const staticPath = 'dist/apps/cf-page/';
const file401 = 'dist/apps/node-vless/assets/401.html';
let filepath = null;
export function serverStaticFile(req: IncomingMessage, resp: ServerResponse) {
  const url = new URL(req.url, `http://${req.headers['host']}`);
  let fileurl = url.pathname;
  fileurl = join(staticPath, fileurl);
  console.log('....', fileurl);
  filepath = resolve(fileurl);
  console.log(filepath);

  if (existsSync(filepath)) {
    let fileExt = extname(filepath);
    console.log('fileExt', fileExt);
    let mimeType = mimeLookup[fileExt];

    resp.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': cacheHeader({
        public: true,
        maxAge: '1year',
        staleWhileRevalidate: '1year',
      }),
    });
    return createReadStream(filepath).pipe(resp);
  } else {
    resp.writeHead(404);
    resp.write('not found');
    resp.end();
    return resp;
  }
}

export function index401(req: IncomingMessage, resp: ServerResponse) {
  const file401Path = resolve(file401);
  if (existsSync(file401Path)) {
    createReadStream(file401Path).pipe(resp);
  } else {
    resp.writeHead(401);
    resp.write('UUID env not set');
    resp.end();
  }
}

export function serverIndexPage(
  req: IncomingMessage,
  resp: ServerResponse,
  uuid
) {
  // if()
}
