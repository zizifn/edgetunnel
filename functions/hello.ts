interface Env {
  KV: KVNamespace;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  console.log('xxxxx', context.env);
  return new Response(`Hello, world! ${context.request.url}`);
};
