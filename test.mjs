import { ReadableStream } from 'stream/web';

try {
  const readableStream = new ReadableStream({
    start(control) {
      setInterval(() => {
        control.enqueue('11');
      }, 1000);
    },
    pull(control) {
      control.enqueue('11');
      // undefined.length;
      // control.close();
      //   control.error('error');
      //   undefined.length;
    },
  });

  await readableStream.pipeTo(
    new WritableStream({
      write(chunk, controller) {
        console.log(chunk);
      },
    })
  );

  console.log('end--------');

  //   for await (const iterator of readableStream) {
  //     console.log(iterator);
  //   }
} catch (error) {
  console.log('---end---', error);
}
