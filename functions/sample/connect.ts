// ignore the typescropt error
// @ts-ignore
import { connect } from 'cloudflare:sockets';

export const onRequest: PagesFunction<any> = async (context) => {
  context.params.user;
  console.log('start fetch');
  const socket = connect({
    hostname: 'neverssl.com',
    port: 80,
  });

  const writer = socket.writable.getWriter();
  const encoder = new TextEncoder();
  const encoded = encoder.encode(
    'GET / HTTP/1.1\r\nHost: neverssl.com\r\n\r\n'
  );
  await writer.write(encoded);

  const reader = socket.readable.getReader();
  const decoder = new TextDecoder();
  let response = '';
  while (true) {
    const res = await reader.read();
    if (res.done) {
      console.log('Stream done, socket connection has been closed.');
      break;
    }
    response += decoder.decode(res.value);
  }

  return new Response(response);
};
