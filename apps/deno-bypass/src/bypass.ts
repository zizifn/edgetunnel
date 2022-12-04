import { serve } from 'https://deno.land/std@0.167.0/http/server.ts';

const userID = Deno.env.get('UUID');

const handler = async (request: Request): Promise<Response> => {
  const headers = request.headers;
  const serverAddress = headers.get('x-host') || '';
  const remotePort = headers.get('x-port') || 443;
  const uuid = headers.get('x-uuid');

  if (!serverAddress || !remotePort || !userID) {
    return new Response(
      `Version 0.0.1-2022/12/04!!
${userID ? 'has UUID env' : 'no UUID env'}
感谢 deno deploy 严肃对待 web standard。支持 HTTP request & response streaming。
      `,
      {
        status: 200,
        headers: {},
      }
    );
  }
  console.log(
    `want to proxy to server address ${serverAddress}, and port ${remotePort}`
  );

  if (uuid !== userID) {
    return new Response('Do not send right UUID!', {
      status: 403,
      headers: {},
    });
  }
  const connection = await Deno.connect({
    port: Number(remotePort),
    hostname: serverAddress,
  });

  // connection.write(
  //   new TextEncoder().encode('GET http://www.baidu.com/  HTTP/1.1\r\n')
  // );
  // connection.write(new TextEncoder().encode('Host: www.baidu.com\r\n\r\n'));
  // connection.close();

  //   GET / HTTP/1.1
  // Host: www.baidu.com
  // User-Agent: curl/7.83.1
  // Accept: */*
  // const body2 = new ReadableStream({
  //   start(controller) {
  //     controller.enqueue(new TextEncoder().encode('GET / HTTP/1.1\r\n'));
  //     controller.enqueue(new TextEncoder().encode('Host: www.baidu.com\r\n'));
  //     controller.enqueue(
  //       new TextEncoder().encode('User-Agent: curl/7.83.1\r\n')
  //     );
  //     controller.enqueue(new TextEncoder().encode('Accept: */*\r\n\r\n'));
  //     // controller.close();
  //   },
  //   cancel() {},
  // });

  // for await (const chunk of body2) {
  //   connection.write(chunk);
  // }
  const proxyResp = request.body?.pipeThrough(connection);
  // const proxyResp = request.body
  //   ?.pipeThrough(
  //     new TransformStream({
  //       async transform(chunk, controller) {
  //         console.log('transform');
  //         controller.enqueue(chunk);
  //       },
  //       async flush(controller) {
  //         console.log('flush');
  //         return new Promise((res) => setTimeout(res, 1000));
  //       },
  //     })
  //   )
  //   .pipeThrough(connection);
  return new Response(proxyResp, {
    status: 200,
    headers: {},
  });
};

serve(handler, { port: 8080, hostname: '0.0.0.0' });
