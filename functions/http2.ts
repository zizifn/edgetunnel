interface Env {
  KV: KVNamespace;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  let count = 0;
  console.log('test11', Date.now());
  await new Promise((resolve, rej) => {
    setTimeout(() => {
      resolve('');
    }, 100);
  });
  console.log('test11', Date.now());
  const transformStream =
    context.request.body?.pipeThrough(new TextDecoderStream()).pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          console.log('test', Date.now());
          controller.enqueue(
            new TextEncoder().encode(`${chunk} + ${count++}  ${new Date()}`)
          );
        },
      })
    ) || 'default';
  return new Response(transformStream, {
    headers: { 'content-type': 'text/plain' },
  });
};
