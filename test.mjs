import { ReadableStream } from 'stream/web';
function delay(ms) {
  return new Promise((resolve, rej) => {
    setTimeout(resolve, ms);
  });
}
try {
  let i = 0;
  const readableStream = new ReadableStream({
    start(control) {
      setInterval(() => {
        control.enqueue(i++);
      }, 100);
      // setTimeout(() => {
      //   control.error('read error');
      // }, 1000);
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
      async write(chunk, controller) {
        console.log(chunk);
        await delay(1);
        controller.error('error');
        // if (chunk === 7) {
        //   throw 'error';
        // }
      },
      close() {
        console.log('close------WritableStream');
      },
      abort(reason) {
        console.log('abort--------');
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
