let isCancel = false;
const readableStream = new ReadableStream({
  start(controller) {
    let count = 0;
    controller.enqueue(`Chunk ${count}`);
    count++;
    controller.enqueue(`Chunk ${count}`);

    // controller.error(new Error('uuid is not valid'));
    // setTimeout(() => {
    //     console.log('ReadableStream was closed------valid22-------.');
    //     controller.error(new Error('uuid is not valid22'));
    // }, 1000);

    // const intervalId = setInterval(() => {
    //     if(!isCancel){
    //   controller.enqueue(`Chunk ${count}`);
    //     }
    // // controller.enqueue(`Chunk ${count}`);
    //   count++;
    //   if (count > 5) {
    //     console.log('ReadableStream was closed-------------.');
    //     // controller.close()
    //     controller.error(new Error('uuid is not valid'));
    //     // clearInterval(intervalId);
    //   }
    // }, 1000);
  },
  async pull(controller) {
    console.log('ReadableStream Pulling data...');
    // await new Promise((resolve) => setTimeout(resolve, 2000));
  },
  cancel() {
    isCancel = true;
    console.log('ReadableStream was canceled.');
  },
});

const writableStream = new WritableStream({
  write(chunk, controller) {
    console.log(`Received data: ${chunk}`);
    if(chunk === 'Chunk 1'){
    controller.error('eroorooororo')
    return;
    }
    // throw new Error('uuid is not valid');

    // setTimeout( ()=>{
    //   try {
    //     throw new Error('setTimeout hasve error valid');
    //   }catch(error){
    //     console.log('////setTimeout hasve error valid');
    //   }
     
    // }, 2000)

    // controller.error(new Error('Received error'));
    if(chunk === 'Chunk 3'){
        throw new Error('uuid is not valid');
    }
  },
  close() {
    console.log('WritableStream was closed');
  },
  abort() {
    console.log('WritableStream was aborted');
    }
});

readableStream.pipeTo(writableStream).catch((err) => {
  console.log('-----------------------error-------------------');
  console.log(err);
});