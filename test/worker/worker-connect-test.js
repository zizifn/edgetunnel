import { connect } from 'cloudflare:sockets';

export default {
  async fetch(request, env, ctx) {
    console.log('start fetch');
    const cloudflare = 'www.cloudflare.com';
    const floodgap = 'gopher.floodgap.com';
    let host = floodgap;
    const isFloodgap = request.url.includes('floodgap');
    const iscloudflare = request.url.includes('cloudflare');
    if (isFloodgap) {
      host = floodgap;
    }
    if (iscloudflare) {
      host = cloudflare;
    }

    try {
      const socket = connect(
        {
          hostname: host,
          port: 443,
        },
        {
          secureTransport: 'on',
        }
      );
      console.log('start conneted', host);
      const writer = socket.writable.getWriter();
      const encoder = new TextEncoder();
      const encoded = encoder.encode(
        `GET / HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: curl/8.0.1\r\nAccept: */*\r\n\r\n`
      );
      await writer.write(encoded);
      console.log('write end');

      return new Response(socket.readable, {
        headers: { 'Content-Type': 'text/plain' },
      });
    } catch (error) {
      return new Response('Socket connection failed: ' + error, {
        status: 500,
      });
    }
  },
};