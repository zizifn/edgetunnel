import { ReadableStream } from 'stream/web';

try {
  let i = 0;
  const writeable = new WritableStream({
    start(controller) {
      console.log('start');
    },
    write(chunk, con) {
      console.log('write', chunk);
    },
    abort(reason) {
      console.log('abort', reason);
    },
  });

  // const write = writeable.getWriter();
  await writeable.abort('1111');
  // await write.write('111');

  console.log('end--------');

  //   for await (const iterator of readableStream) {
  //     console.log(iterator);
  //   }
} catch (error) {
  console.log('---end---', error);
}
