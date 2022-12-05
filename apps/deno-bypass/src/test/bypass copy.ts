import { serve } from 'https://deno.land/std@0.167.0/http/server.ts';

const userID = Deno.env.get('UUID') || '***REMOVED******';

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
  const result = request.body?.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        console.log('-- transform--');
        controller.enqueue(chunk);
      },
    })
  );
  const proxyResp = result?.pipeThrough(connection);
  for await (let chunk of connection.readable) {
    console.log('-------', new TextDecoder().decode(chunk));
  }
  // let timer: number | undefined = undefined;
  // const body = new ReadableStream({
  //   start(controller) {
  //     timer = setInterval(() => {
  //       const message = `It is ${new Date().toISOString()}\n`;
  //       controller.enqueue(new TextEncoder().encode(message));
  //     }, 1000);
  //   },
  //   pull(chunk) {},
  //   cancel() {
  //     if (timer !== undefined) {
  //       clearInterval(timer);
  //     }
  //   },
  // });
  return new Response('111', {
    status: 200,
    headers: {},
  });
};

serve(handler, { port: 8080, hostname: '0.0.0.0' });
