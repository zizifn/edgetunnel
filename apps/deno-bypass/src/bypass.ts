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

  // 1. request.body readablestream end casue socket to be end, this will casue socket send FIN package early
  // and casue deno can't get TCP pcakge.
  // 2. current soluction for this, let proxy client wait for few ms and then end readablestream
  // 3. this is only inpact HTTP proxy not https
  const proxyResp = request.body?.pipeThrough(connection);
  return new Response(proxyResp, {
    status: 200,
    headers: {},
  });
};

serve(handler, { port: 8080, hostname: '0.0.0.0' });
