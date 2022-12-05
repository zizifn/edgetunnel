import { serve } from 'https://deno.land/std@0.167.0/http/server.ts';

const handler = async (request: Request): Promise<Response> => {
  const connection = await Deno.connect({
    port: 80,
    hostname: 'www.baidcu.com',
  });

  //   GET / HTTP/1.1
  // Host: www.baidu.com
  // User-Agent: curl/7.83.1
  // Accept: */*
  const body2 = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('GET / HTTP/1.1\r\n'));
      controller.enqueue(new TextEncoder().encode('Host: www.baidu.com\r\n'));
      controller.enqueue(
        new TextEncoder().encode('User-Agent: curl/7.83.1\r\n')
      );
      controller.enqueue(new TextEncoder().encode('Accept: */*\r\n\r\n'));
      controller.close(); // 注释这个就好用
    },
    cancel() {},
  });

  // 或者不用 pipeThrough， 直接write
  // for await (const chunk of body2) {
  //   connection.write(chunk);
  // }
  // const proxyResp = connection.readable;

  // -----------
  const proxyResp = body2?.pipeThrough(connection);

  return new Response(proxyResp, {
    status: 200,
    headers: {},
  });
};

serve(handler, { port: 8080, hostname: '0.0.0.0' });
