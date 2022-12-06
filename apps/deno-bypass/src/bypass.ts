import { serve } from 'https://deno.land/std@0.167.0/http/server.ts';
import { buildRawHttp500, isVaildateReq } from './helper.ts';
const userID = Deno.env.get('UUID');

const handler = async (request: Request): Promise<Response> => {
  // console.log('--------start--------');
  try {
    const headers = request.headers;
    const serverAddress = headers.get('x-host') || '';
    const remotePort = headers.get('x-port') || 443;
    const isHttp = headers.get('x-http') === 'true';
    const uuid = request.headers.get('x-uuid');

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
    if (uuid !== userID) {
      return new Response(buildRawHttp500('Do not send right UUID!'), {
        status: 403,
        headers: {},
      });
    }

    if (!isVaildateReq(request)) {
      return new Response(
        buildRawHttp500(
          'request is not vaild due to lcoalip or request body is null'
        ),
        {
          status: 500,
          headers: {},
        }
      );
    }
    console.log(
      `want to proxy to server address ${serverAddress}, and port ${remotePort}`
    );

    const connection = await Deno.connect({
      port: Number(remotePort),
      hostname: serverAddress,
    });

    // const proxyResp = request.body?.pipeThrough(connection);
    // 1. request.body readablestream end casue socket to be end, this will casue socket send FIN package early
    // and casue deno can't get TCP pcakge.
    // 2. current soluction for this, let proxy client wait for few ms and then end readablestream
    // 3. this is only inpact HTTP proxy not https
    let readablestreamRsp = connection.readable;
    if (isHttp) {
      // if is http, we need wait for request read, or we can warpper into async function
      for await (let chunk of request.body || []) {
        // console.log(new TextDecoder().decode(chunk));
        connection.write(chunk);
      }
      readablestreamRsp = connection.readable;
    } else {
      readablestreamRsp = request.body!.pipeThrough(connection);
    }

    return new Response(readablestreamRsp, {
      status: 200,
      headers: {},
    });
  } catch (error) {
    console.log(error);
    return new Response(buildRawHttp500('has error'), {
      status: 500,
      headers: {},
    });
  }
};

serve(handler, { port: 8080, hostname: '0.0.0.0' });
