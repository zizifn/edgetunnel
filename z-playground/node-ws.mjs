import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', function connection(ws) {
    ws.on('error', console.error);

    ws.on('message', function message(data) {
        console.log('received: %s', data);
        if (data.toString() === 'close') {
            console.log('---------close--------');
            ws.close()
        }
    });
    ws.on('close', () => {
        console.log('-----------in close-------------close');
        console.log(ws.readyState);
        ws.send("xxxxxx")
        ws.close()

        setTimeout(() => {
            console.log(ws.readyState);
            ws.close()
        }, 10000)
    })

    ws.send('something');
});