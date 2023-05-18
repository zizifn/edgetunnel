export default {
  async fetch(request: Request) {
    let address = '';
    let portWithRandomLog = '';

    const log = (info: string, event?: any) => {
      console.log(`[${address}:${portWithRandomLog}] ${info}`, event || '');
    };

    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, webSocket] = Object.values(webSocketPair);
    const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
    webSocket.accept();
    webSocket.addEventListener('message', (event) => {
      console.log(event.data);
      webSocket.send(`server reponse after client sent ${event.data}`);
      if (event.data === 'close') {
        webSocket.close();
      }
    });
    webSocket.addEventListener('close', async (event) => {
      console.log(
        '-------------close-----------------',
        event,
        webSocket.readyState
      );
      webSocket.close();
    });

    webSocket.addEventListener('error', () => {
      console.log('-------------error-----------------');
    });

    client.addEventListener('close', (event) => {
      console.log('----------client---close-----------------', event);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};
