import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';
import * as uuid from 'https://jspm.dev/uuid';
import * as lodash from 'https://jspm.dev/lodash-es';
import { serveClient } from './deno/client.ts';
import { processWebSocket } from '../../../libs/vless-js/src/lib/vless-js.ts';

const userID = Deno.env.get('UUID') || '';
let isVaildUser = uuid.validate(userID);
if (!isVaildUser) {
  console.log('not set valid UUID');
}

const handler = async (req: Request): Promise<Response> => {
  if (!isVaildUser) {
    const index401 = await Deno.readFile(
      `${Deno.cwd()}/apps/deno-vless/src/deno/401.html`
    );
    return new Response(index401, {
      status: 401,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    });
  }
  const upgrade = req.headers.get('upgrade') || '';
  if (upgrade.toLowerCase() != 'websocket') {
    return await serveClient(req, userID);
  }
  const { socket, response } = Deno.upgradeWebSocket(req);
  socket.addEventListener('open', () => {});

  let test: Deno.TcpConn | null = null;
  // test!.writable.abort();
  //
  processWebSocket({
    userID,
    webSocket: socket,
    rawTCPFactory: (port: number, hostname: string) => {
      return Deno.connect({
        port,
        hostname,
      });
    },
    libs: { uuid, lodash },
  });
  return response;
};

globalThis.addEventListener('beforeunload', (e) => {
  console.log('About to exit...');
});

globalThis.addEventListener('unload', (e) => {
  console.log('Exiting');
});
serve(handler, { port: 8080, hostname: '0.0.0.0' });
