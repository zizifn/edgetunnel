// 导入相关模块和库
import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';
import * as uuid from 'https://jspm.dev/uuid';
// import * as lodash from 'https://jspm.dev/lodash-es';
import {
    closeWebSocket,
    // delay,
    makeReadableWebSocketStream,
    processVlessHeader,
  } from 'https://raw.githubusercontent.com/3Kmfi6HP/edgetunnel/main/apps/deno-playground/vless-js.ts';
 
// 获取 UUID 环境变量或者默认值
const userID = Deno.env.get('UUID') || '41446577-9ca4-4358-8082-1be0e65aace0';
// 多用户模式
const users = [
    { username: "alice", password: "password123", uuid: userID },
    { username: "bob", password: "letmein", uuid: userID },
  ];
// 生成指定长度的随机字符串
function generateRandomString(length: number): string {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// 构造 vless URL，返回字符串
function getVlessURL(uuid: string, hostname: string, options: { ws0Rtt?: boolean } = {}) {
    let pathParam = generateRandomString(Math.floor(Math.random() * 11) + 10);
    pathParam = `&path=${encodeURIComponent(pathParam)}?ed=2048`;
    return `vless://${uuid}@${hostname}:443?encryption=none&security=tls&type=ws${pathParam || ''}#${hostname}`;
}

// 处理客户端请求
async function serveClient(req: Request, basePath: string) {
    // 获取 Authorization 头信息
    const basicAuth = req.headers.get('Authorization') || '';
    const authString = basicAuth.split(' ')?.[1] || '';
    console.log(basePath);
    console.log(req);

    // 判断是否为 info 请求并且验证通过
    const pathname = new URL(req.url).pathname;
    if (pathname.startsWith('/info') && atob(authString).includes(basePath)) {
        // 获取环境变量和请求信息
        const env = Deno.env.toObject();
        const responseObj = {
            message: 'hello world',
            upgradeHeader: req.headers.get('upgrade') || '',
            authString: authString,
            uuidValidate: basePath,
            method: req.method,
            environment: env,
            url: req.url,
            proto: req.proto,
            headers: Object.fromEntries(req.headers.entries()),
            body: req.body ? new TextDecoder().decode(await req.arrayBuffer()) : undefined,
        };
        const responseBody = JSON.stringify(responseObj);
        return new Response(responseBody, {
            status: 200,
            headers: {
                'content-type': 'application/json; charset=utf-8',
            },
        });
    }

    // 如果是包含 basePath 的请求，构造 vless URL 返回
    if (pathname.includes(basePath)) {
        const url = new URL(req.url);
        const uuid = Deno.env.get('UUID') || basePath;;
        console.log(uuid);
        const hostname = url.hostname;
        const vlessURL = getVlessURL(uuid, hostname, { ws0Rtt: true });

        const result = `
  *******************************************
  ${atob('VjItcmF5Tjo=')}
  ----------------------------
  ${vlessURL.replace('vless://,', 'vless://')}
  *******************************************
  ${atob('U2hhZG93cm9ja2V0Og==')}
  ----------------------------
  ${vlessURL.replace('vless://,', 'vless://')}
  *******************************************
  ${atob('Q2xhc2g6')}
  ----------------------------
  - {name: Argo-Vless, type: vless, server: ${hostname}, port: 443, uuid: ${uuid}, tls: true, servername: ${hostname}, skip-cert-verify: false, network: ws, ws-opts: {path: /${encodeURIComponent(generateRandomString(Math.floor(Math.random() * 11) + 10))}?ed=2048, headers: { Host: ${hostname}}}, udp: false}`;

        return new Response(result, {
            status: 200,
            headers: {
                'content-type': 'text/plain; charset=utf-8',
            },
        });
    }
    console.log(authString);
    console.log(basicAuth);
    // 查找用户
    const user = users.find(user => {
    const decoded = atob(authString);
    return user.username + ':' + user.password === decoded && user.uuid === basePath;
  });
    if (atob(authString).includes(basePath) || user) {
    // if (user) {
        console.log(basePath);
        console.log('302');
        return new Response(``, {
            status: 302,
            headers: {
                'content-type': 'text/html; charset=utf-8',
                Location: `./${basePath}`,
            },
        });
    } else {
        return new Response(``, {
            status: 401,
            headers: {
                'content-type': 'text/html; charset=utf-8',
                'WWW-Authenticate': 'Basic',
            },
        });
    }
}

export {
    serveClient
};

// function uuidValidate(this: void, value: string, index: number, obj: string[]): value is any {
//     throw new Error('Function not implemented.');
// } 
let isVaildUser = uuid.validate(userID);
// 验证用户 ID 是否有效
if (!isVaildUser) {
    console.log('not valid');
}// 如果用户 ID 无效，打印信息


const handler = async (req: Request): Promise < Response > => {
    if (!isVaildUser) {
        // 如果用户 ID 无效
        const response = await fetch("https://401.deno.dev");
        // 发起 HTTP 请求
        const body = await response.text();
        // 取得响应文本
        return new Response(body, {
            status: 200
        });
        // 返回响应

    }
    // 如果用户 ID 有效，继续执行
    const upgrade = req.headers.get('upgrade') || '';
    // 取出 Upgrade 请求头
    console.log(upgrade);
    // 如果请求头不是 websocket，返回普通 HTTP 响应
    if (upgrade.toLowerCase() != 'websocket') {
        console.log('not websocket request header get upgrade is ' + upgrade);
        return await serveClient(req, userID);
    }
    const {
        socket, // WebSocket 实例
        response // WebSocket 响应
    } = Deno.upgradeWebSocket(req); // 升级 HTTP 连接为 WebSocket 连接
    socket.addEventListener('open', () => {}); // 监听 WebSocket 打开事件
// let test: Deno.TcpConn | null = null;
  // test!.writable.abort();
  //
  const earlyDataHeader = req.headers.get('sec-websocket-protocol') || '';

  processWebSocket({
    userID,
    webSocket: socket,
    earlyDataHeader,
    // rawTCPFactory: (port: number, hostname: string) => {
    //   return Deno.connect({
    //     port,
    //     hostname,
    //   });
    // },
  });
  return response;
};

async function processWebSocket({
  userID,
  webSocket,
  earlyDataHeader,
}: // libs: { uuid, lodash },
{
  userID: string;
  webSocket: WebSocket;
  earlyDataHeader: string;
  // rawTCPFactory: (port: number, hostname: string) => Promise<any>;
  // libs: { uuid: any; lodash: any };
}) {
  let address = '';
  let portWithRandomLog = '';
  let remoteConnection: {
    readable: any;
    writable: any;
    write: (arg0: Uint8Array) => any;
    close: () => void;
  } | null = null;
  let remoteConnectionReadyResolve: Function;
  try {
    const log = (info: string, event?: any) => {
      console.log(`[${address}:${portWithRandomLog}] ${info}`, event || '');
    };
    const readableWebSocketStream = makeReadableWebSocketStream(
      webSocket,
      earlyDataHeader,
      log
    );
    let vlessResponseHeader: Uint8Array | null = null;

    // ws --> remote
    readableWebSocketStream
      .pipeTo(
        new WritableStream({
          async write(chunk, controller) {
            const vlessBuffer = chunk;
            if (remoteConnection) {
              const number = await remoteConnection.write(
                new Uint8Array(vlessBuffer)
              );
              return;
            }
            const {
              hasError,
              message,
              portRemote,
              addressRemote,
              rawDataIndex,
              vlessVersion,
              isUDP,
            } = processVlessHeader(vlessBuffer, userID);
            address = addressRemote || '';
            portWithRandomLog = `${portRemote}--${Math.random()}`;
            if (isUDP) {
              console.log('udp');
              controller.error(
                `[${address}:${portWithRandomLog}] command udp is not support `
              );
              return;
            }
            if (hasError) {
              controller.error(`[${address}:${portWithRandomLog}] ${message} `);
            }
            // const addressType = requestAddr >> 4;
            // const addressLength = requestAddr & 0x0f;
            console.log(`[${address}:${portWithRandomLog}] connecting`);
            remoteConnection = await Deno.connect({
              port: portRemote!,
              hostname: address,
            });
            vlessResponseHeader = new Uint8Array([vlessVersion![0], 0]);
            const rawClientData = vlessBuffer.slice(rawDataIndex!);
            await remoteConnection!.write(new Uint8Array(rawClientData));
            remoteConnectionReadyResolve(remoteConnection);
          },
          close() {
            console.log(
              `[${address}:${portWithRandomLog}] readableWebSocketStream is close`
            );
          },
          abort(reason) {
            console.log(
              `[${address}:${portWithRandomLog}] readableWebSocketStream is abort`,
              JSON.stringify(reason)
            );
          },
        })
      )
      .catch((error) => {
        console.error(
          `[${address}:${portWithRandomLog}] readableWebSocketStream pipeto has exception`,
          error.stack || error
        );
        // error is cancel readable stream anyway, no need close websocket in here
        // closeWebSocket(webSocket);
        // close remote conn
        // remoteConnection?.close();
      });
    await new Promise((resolve) => (remoteConnectionReadyResolve = resolve));
    let remoteChunkCount = 0;
    let totoal = 0;
    // remote --> ws
    await remoteConnection!.readable.pipeTo(
      new WritableStream({
        start() {
          if (webSocket.readyState === webSocket.OPEN) {
            webSocket.send(vlessResponseHeader!);
          }
        },
        async write(chunk: Uint8Array, controller) {
          function send2WebSocket() {
            if (webSocket.readyState !== webSocket.OPEN) {
              controller.error(
                `can't accept data from remoteConnection!.readable when client webSocket is close early`
              );
              return;
            }
            webSocket.send(chunk);
          }

          remoteChunkCount++;
          //#region
          // console.log(
          //   `${(totoal +=
          //     chunk.length)}, count: ${remoteChunkCount.toString()}, ${
          //     chunk.length
          //   }`
          // );
          // https://github.com/zizifn/edgetunnel/issues/87, hack for this issue, maybe websocket sent too many small chunk,
          // casue v2ray client can't process https://github.com/denoland/deno/issues/17332
          // limit X number count / bandwith, due to deno can't read bufferedAmount in deno,
          // this is deno bug and this will not need in nodejs version
          //#endregion
        //   if (remoteChunkCount < 20) {
        //     send2WebSocket();
        //   } else if (remoteChunkCount < 120) {
        //     await delay(10); // 64kb * 100 = 6m/s
        //     send2WebSocket();
        //   } else if (remoteChunkCount < 500) {
        //     await delay(20); // (64kb * 1000/20) = 3m/s
        //     send2WebSocket();
        //   } else {
        //     await delay(50); // (64kb * 1000/50)  /s
            send2WebSocket();
        //   }
        },
        close() {
          console.log(
            `[${address}:${portWithRandomLog}] remoteConnection!.readable is close`
          );
        },
        abort(reason) {
          closeWebSocket(webSocket);
          console.error(
            `[${address}:${portWithRandomLog}] remoteConnection!.readable abort`,
            reason
          );
        },
      })
    );
  } catch (error: any) {
    console.error(
      `[${address}:${portWithRandomLog}] processWebSocket has exception `,
      error.stack || error
    );
    closeWebSocket(webSocket);
  }
  return;
}

globalThis.addEventListener('beforeunload', (e) => {
  console.log('About to exit...');
});

globalThis.addEventListener('unload', (e) => {
  console.log('Exiting');
});
serve(handler, { port: 8080, hostname: '0.0.0.0' });
