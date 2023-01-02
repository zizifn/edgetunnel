import { ReadableStream } from 'stream/web';

try {
  const readableStream = new ReadableStream({
    start(control) {
      setInterval(() => {
        control.enqueue('11');
      }, 100);
    },
    pull(control) {
      // control.enqueue('11');
      // undefined.length;
      // control.close();
      //   control.error('error');
      //   undefined.length;
    },
    cancel(reason) {
      console.log('---------', reason);
    },
  });

  setTimeout(() => {
    console.log('cancel');
  }, 2000);

  await readableStream.pipeTo(
    new WritableStream({
      write(chunk, controller) {
        console.log(chunk);
      },
      close() {
        console.log('close------WritableStream');
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
