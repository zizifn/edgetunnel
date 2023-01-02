import { vlessJs } from 'vless-js';
interface Env {
  KV: KVNamespace;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  console.log('xxxxx', context.env, vlessJs());
  return new Response(`Hello, world! ${context.request.url}--${vlessJs()}`);
};
