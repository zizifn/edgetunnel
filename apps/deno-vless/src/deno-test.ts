import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';
import * as uuid from 'https://jspm.dev/uuid';
import * as lodash from 'https://jspm.dev/lodash-es';
import { serveClient } from './deno/client.ts';
import { processWebSocket } from '../../../libs/vless-js/src/lib/vless-js.ts';

const handler = async (req: Request) => {
  console.log('start');

  const connect = await Deno.connect({
    port: 443,
    hostname: '2606:4700:0000:0000:0000:0000:6810:7c60',
  });

  console.log(connect.remoteAddr);
  return new Response('hello', {
    status: 200,
  });
};
serve(handler, { port: 8081, hostname: '0.0.0.0' });
