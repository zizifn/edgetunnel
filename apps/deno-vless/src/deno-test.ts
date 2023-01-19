import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';

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
