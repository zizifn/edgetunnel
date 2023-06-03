import { connect } from 'cloudflare:sockets';

export default {
  async fetch(request, env, ctx) {
    console.log('start fetch111');
    const url = new URL(request.url);
    const target = url.searchParams.get('target');
    // if (!target) {
    //   return new Response('target is empty', {
    //     status: 500,
    //   });
    // }
    try {

      try {
      /** @type {import("@cloudflare/workers-types").Socket}*/
        const socket = connect(
          {
            hostname: target,
            port: 443,
          }
        );

        // socket.closed.then(() => {
        //   console.log('....socket.closed.then............');
        // }).catch((e) => {
        //   console.log('.........socket.closed.error.............', e);
        // }).finally(() => {
        //   console.log('.........socket.closed.finally.............');
        // })
        // console.log('---------------close-------');
  
        // socket.readable.getReader().closed.then(() => {
        //   console.log('.........socket.readabl.....closed then.............');
        // }).catch((e) => {
        //   console.log('....socket.readabl.....catch closing.............', e);
        // })

        await socket.writable.getWriter().write(new Uint8Array([1,2,3,4,5,6,7,8,9,10]))

        // await delay(10)

      } catch (e) {
        console.log('connect error', e);
      }
      console.log('start conneted', target);

      


      // const writer = socket.writable.getWriter();
      // const encoder = new TextEncoder();
      // const encoded = encoder.encode(
      //   `GET / HTTP/1.1\r\nHost: ${target}\r\nUser-Agent: curl/8.0.1\r\nAccept: */*\r\n\r\n`
      // );
      // await writer.write(encoded);
      // // await writer.close();
      // console.log('write end');

      // await delay(1)
      return new Response('yyyyyyyyyyyyyyyyyyyyyyyyyy', {
        headers: { 'Content-Type': 'text/plain' },
        status: 500,
      });
    } catch (error) {
      console.log('Socket connection failed: ' + error);
      return new Response('Socket connection failed: ' + error, {
        status: 500,
      });
    }
  },
};

function delay(timeout) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}