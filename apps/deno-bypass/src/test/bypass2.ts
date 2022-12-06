import { serve } from 'https://deno.land/std@0.167.0/http/server.ts';

console.log('Current Deno version', Deno.version.deno);

const handler = async (request: Request): Promise<Response> => {
  const connection = await Deno.connect({
    port: 80,
    hostname: 'www.baidu.com',
  });
  const body2 = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('GET / HTTP/1.1\r\n'));
      controller.enqueue(new TextEncoder().encode('Host: www.baidu.com\r\n'));
      controller.enqueue(
        new TextEncoder().encode('User-Agent: curl/7.83.1\r\n')
      );
      controller.enqueue(new TextEncoder().encode('Accept: */*\r\n\r\n'));
      controller.close();
    },
    cancel() {},
  });

  // for await (const chunk of body2) {
  //   console.log('11', new TextDecoder().decode(chunk));
  // }
  const proxyResp = body2?.pipeThrough(connection);

  for await (const chunk of proxyResp) {
    console.log('11', new TextDecoder().decode(chunk));
  }
  return new Response('111', {
    status: 200,
    headers: {
      'x-ray': 'xxxx',
    },
  });
};

serve(handler, { port: 8080, hostname: '0.0.0.0' });
