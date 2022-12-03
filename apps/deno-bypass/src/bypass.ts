import { serve } from 'https://deno.land/std@0.157.0/http/server.ts';

const userID = Deno.env.get('UUID');

const handler = async (request: Request): Promise<Response> => {
  const headers = request.headers;
  const serverAddress = headers.get('x-host') || '';
  const remotePort = headers.get('x-port') || 443;
  const uuid = headers.get('x-uuid');

  if (!serverAddress || !remotePort || !userID) {
    return new Response(
      `Version 0.0.1-2022/12/03!!
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
  const proxyResp = request.body?.pipeThrough(connection);
  return new Response(proxyResp, {
    status: 200,
    headers: {},
  });
};

serve(handler, { port: 8080, hostname: '0.0.0.0' });
