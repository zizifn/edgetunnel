
const chunk = '0'.repeat(1024 * 5);
export default {
    async fetch(request, env, ctx) {
        try {
            console.log('---------------');
            const webSocketPair = new WebSocketPair();
            /** @type {import("@cloudflare/workers-types").WebSocket[]} */
            const [client, webSocket] = Object.values(webSocketPair);
            webSocket.accept();
            let btyes = 0;
            // (async () => {
            //     const repose = await fetch('http://speed.cloudflare.com/__down?bytes=1145141919810')
            //     const body = repose.body;
            //     const reader = body?.getReader();
            //     let packets = [];
            //     while (true && reader) {
            //         const { done, value } = await reader.read();
            //         packets.push(value);
            //         console.log(btyes += value?.length || 0);
            //         if (packets.length > 100) {
            //             webSocket.send(value || '');
            //             await delay(2);
            //             packets = [];
            //         }
            //         if (done) {
            //             break;
            //         }
            //     }
            // })()
            console.log('---------------');
            (async () => {
                let packets = [];
                console.log('---------------');
                while (true) {
                    console.log(btyes += chunk?.length || 0);
                    webSocket.send(chunk || '');
                    await delay(1)
                }
            })()
            // console.log(btyes += chunk?.length || 0);
            // webSocket.send(chunk || '');

            return new Response(null, {
                status: 101,
                webSocket: client,
            });

        } catch (err) {
			/** @type {Error} */ let e = err;
            return new Response(e.toString());
        }
    },
};

function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}