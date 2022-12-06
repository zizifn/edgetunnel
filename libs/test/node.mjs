import { createServer } from 'node:http';
import { connect } from 'node:net';
import { Readable, Duplex, Writable } from 'node:stream';
import { ReadableStream, WritableStream } from 'node:stream/web';

const httpServer = createServer(async (req, resp) => {
  //   const rawHttp = new ReadableStream({
  //     start(controller) {
  //       controller.enqueue(new TextEncoder().encode('GET / HTTP/1.1\r\n'));
  //       controller.enqueue(new TextEncoder().encode('Host: www.baidu.com\r\n'));
  //       controller.enqueue(
  //         new TextEncoder().encode('User-Agent: curl/7.83.1\r\n')
  //       );
  //       controller.enqueue(new TextEncoder().encode('Accept: */*\r\n\r\n'));
  //       controller.close();
  //     },
  //     cancel() {},
  //   });
  // async function* resposne() {
  //   for await (const chunk of [
  //     'GET / HTTP/1.1\r\n',
  //     'Host: www.baidu.com\r\n',
  //     'User-Agent: curl/7.83.1\r\n',
  //     'Accept: */*\r\n\r\n',
  //   ]) {
  //     yield chunk;
  //   }
  // }
  // const buffer = resposne();
  // const rawHttp = new Readable({
  //   async read() {
  //     console.log('pull----');
  //     const { value, done } = await buffer.next();
  //     if (!done) {
  //       this.push(value);
  //     }
  //   },
  // });
  const rawHttp = Readable.from([
    'GET / HTTP/1.1\r\n',
    'Host: www.baidu.com\r\n',
    'User-Agent: curl/7.83.1\r\n\r\n',
  ]);
  // rawHttp.p;
  // rawHttp.push('Accept: */*\r\n\r\n');
  rawHttp.on('end', () => {
    console.log('rawHttp--end-----');
  });
  const socket = connect(
    {
      port: 80,
      host: 'www.baidu.com',
    },
    () => {
      console.log('connected');
      resp.writeHead(200);
      process.nextTick(() => {
        rawHttp.pipe(socket).pipe(resp);
      });
    }
  );

  // .pipe(resp)
  // .on('close', () => {
  //   console.log('--close-----');
  // });
});

httpServer.listen('8888', () => {
  console.log('Server runnig at http://localhost:8888');
});

// const httpServer = createServer(async (req, resp) => {
//   const rawHttp = new ReadableStream({
//     start(controller) {
//       controller.enqueue(new TextEncoder().encode('GET / HTTP/1.1\r\n'));
//       controller.enqueue(new TextEncoder().encode('Host: www.baidu.com\r\n'));
//       controller.enqueue(
//         new TextEncoder().encode('User-Agent: curl/7.83.1\r\n')
//       );
//       controller.enqueue(new TextEncoder().encode('Accept: */*\r\n\r\n'));
//       controller.close();
//     },
//     cancel() {},
//   });
//   const socket = connect({
//     port: 80,
//     host: 'www.baidu.com',
//   });
//   resp.writeHead(200);
//   const webStreamSocket = rawHttp.pipeThrough(Duplex.toWeb(socket));
//   Readable.fromWeb(webStreamSocket).pipe(resp);
// });

// httpServer.listen('8888', () => {
//   console.log('Server runnig at http://localhost:8888');
// });
