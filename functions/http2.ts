interface Env {
  KV: KVNamespace;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const transformStream =
    context.request.body?.pipeThrough(new TextDecoderStream()).pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          console.log('test');
          controller.enqueue(
            new TextEncoder().encode(`${chunk} +  ${new Date()}`)
          );
        },
      })
    ) || 'default';
  return new Response(transformStream, {
    headers: { 'content-type': 'text/plain' },
  });
};
