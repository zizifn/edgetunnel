interface Env {
  KV: KVNamespace;
}

export const onRequest: PagesFunction<Env> = async ({ request, data }) => {
  console.log(data);
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();
  server.addEventListener('message', (event) => {
    console.log(event.data);
    server.send(`server reponse after client sent ${event.data}`);
  });
  server.send(`client sned`);
  return new Response(null, {
    status: 101,
    webSocket: client,
  });
};
