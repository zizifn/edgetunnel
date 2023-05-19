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
      // throw 'pipeTo error';
      control.enqueue(undefined);
      control.enqueue(1);
      setTimeout(()=>{
        control.close()
      }, 500)
      // control.close();
      // control.error('eroro000-----readableStream--------');
      // setTimeout(() => {
      //   console.log('-----------------100');
      //   control.error('eroro000-----readableStream--------');
      // }, 100);
      // setInterval(() => {
      //   control.enqueue(i++);
      // }, 100);
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
      console.log('-ReadableStream---cancel-----', reason);
    },
  });

  // setTimeout(() => {
  //   console.log('cancel');
  // }, 2000);

  // readableStream.pipeThrough(new TransformStream({
  //   start(controller){
  //     // setTimeout(()=>{
  //     //   controller.error('xxxxxx')
  //     //   console.log('--transform--start-');

  //     // },3000)

  //   },
  //   transform(chunk, controller){
  //     // throw 'err'
  //      Promise.reject('xxxx')
  //     // setTimeout(()=>{
  //     //   console.log('--transform---');
  //     // // throw '333'
  //     // }, 2000)
  //     // controller.enqueue(chunk)
  //   }
  // }))

  // await read1.pipeTo(
  //   new WritableStream({
  //     async write(chunk, controller) {
  //       console.log(chunk);
  //       // throw 'pipeTo error';
  //       // controller.error('pipeTo has error');
  //       // await delay(1);
  //       // controller.error('error');
  //       // if (chunk === 7) {
  //       //   throw 'error';
  //       // }
  //     },
  //     close() {
  //       console.log('close------WritableStream');
  //     },
  //     abort(reason) {
  //       console.log('abort--------', reason);
  //     },
  //   })
  // );

  // console.log('end--------');

  //   for await (const iterator of readableStream) {
  //     console.log(iterator);
  //   }
} catch (error) {
  console.log('---end---', error);
}




try{
  console.log('----------');
  const transform = new TransformStream({
    start(controller){
      // setInterval(()=>{
      //   controller.enqueue('1234')
      // }, 1000)

    },
    async transform(chunk, controller){
      console.log('----------', chunk);
      // controller.error('xxxxxxxxxxxxxxxxxxxxx')
      // throw 'xxxxxx'
      // console.log('----------', chunk);
      //  Promise.reject('xxxx')

      setTimeout(()=>{
        controller.error('xxxxxxxxxxxxxxxxxxxxx')
      // throw '333'
      }, 2000)
      controller.enqueue(chunk)
      return '-======='
    }
  })
  transform.readable.pipeTo(
    new WritableStream({
     async write(chunk, controller) {
       console.log(chunk);
       // throw 'pipeTo error';
       // controller.error('pipeTo has error');
       // await delay(1);
       // controller.error('error');
       // if (chunk === 7) {
       //   throw 'error';
       // }
     },
     close() {
       console.log('close------WritableStream');
     },
     abort(reason) {
       console.log('abort--------', reason);
     },
   })).catch(error=>{
    console.log(error);
   })
const getWriter = transform.writable.getWriter()
await getWriter.write('abc').catch(error=>console.log(error))
getWriter.releaseLock()
console.log('xxxxxx');

  }catch(errpr){
    console.log(errpr);
  }