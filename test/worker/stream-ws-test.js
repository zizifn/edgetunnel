export default {
    async fetch(request, env, ctx) {
        const upgradeHeader = request.headers.get('Upgrade');
        if (!upgradeHeader || upgradeHeader !== 'websocket') {
            return new Response('not websocket', { status: 200 });
        }
        const webSocketPair = new WebSocketPair();
        const [client, webSocket] = Object.values(webSocketPair);
        webSocket.accept();
        let count = 0;
        const readableStream = new ReadableStream({
            start(controller) {
                setInterval(() => {
                    controller.enqueue(count);
                    count++;
                }, 500)

            },
            async pull(controller) {
            },
            cancel() {
                console.log('ReadableStream was canceled.');
            },
        });

        const writableStream = new WritableStream({
            write(chunk, controller) {
                console.log(`Received data: ${chunk}`);
                webSocket.send(`Received data: ${chunk}`);
                if (chunk === 3) {
                    controller.error('eroorooororo')
                    return;
                }

            },
            close() {
                console.log('WritableStream was closed');
            },
            abort() {
                console.log('WritableStream was aborted');
            }
        });
        readableStream.pipeTo(writableStream).catch((error) => {
            console.log('pipeTo error', error);
            webSocket.close();
        });
        webSocket.addEventListener('close', () => {
            console.log('close');
        });
        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }
};