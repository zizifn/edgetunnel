// 导入相关模块和库
import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';
import * as uuid from 'https://jspm.dev/uuid';
import * as lodash from 'https://jspm.dev/lodash-es';

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
            supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
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

function uuidValidate(this: void, value: string, index: number, obj: string[]): value is any {
    throw new Error('Function not implemented.');
}

export function vlessJs(): string {
    return 'vless-js';
}
/*
定义 delay 函数，返回一个 Promise 对象，延迟指定的毫秒数
参数：ms - 毫秒数
*/
export function delay(ms: number) {
    return new Promise((resolve, rej) => {
        setTimeout(resolve, ms);
    });
}
/*

定义 processWebSocket 函数，返回一个 Promise 对象，用于处理 WebSocket
参数：一个包含 userID、webSocket、rawTCPFactory、libs 等属性的对象
userID - 用户 ID
webSocket - WebSocket 对象
rawTCPFactory - 创建一个 TCP 连接的函数，返回一个 Promise 对象
libs - 包含 uuid 和 lodash 属性的对象
*/
export async function processWebSocket({
    userID,
    webSocket,
    rawTCPFactory,
    libs: {
        uuid,
        lodash
    },
}: {
    userID: string;
    webSocket: WebSocket;
    rawTCPFactory: (port: number, hostname: string) => Promise < any > ;
    libs: {
        uuid: any;lodash: any
    };
}) {
    let address = ''; // 远程服务器地址
    let portWithRandomLog = ''; // 远程服务器端口号
    let remoteConnection: { // 远程 TCP 连接
        readable: any;
        writable: any;
        write: (arg0: Uint8Array) => any;
        close: () => void;
    } | null = null; // 远程 TCP 连接对象，初始值为 null
    let remoteConnectionReadyResolve: Function; // remoteConnectionPromise 的解决函数
    try {
        const log = (info: string, event ? : any) => {
        };
        const readableWebSocketStream = makeReadableWebSocketStream(webSocket, log); // 创建可读的 WebSocket 流
        let vlessResponseHeader: Uint8Array | null = null;// VLESS 协议响应头
        // ws --> remote
        // 将可读的 WebSocket 流中的数据发送到远程 TCP 连接中
        readableWebSocketStream
            .pipeTo(
                new WritableStream({
                    async write(chunk, controller) {
                        const vlessBuffer = chunk; // 读取 WebSocket 数据流中的数据
                        if (remoteConnection) {
                            const number = await remoteConnection.write(
                                new Uint8Array(vlessBuffer)
                            );
                            return;
                        }// 处理 VLESS 协议头部
                        const {
                            hasError,
                            message,
                            portRemote,
                            addressRemote,
                            rawDataIndex,
                            vlessVersion,
                        } = processVlessHeader(vlessBuffer, userID, uuid, lodash);
                        address = addressRemote || ''; // 获取远程服务器地址
                        portWithRandomLog = `${portRemote}--${Math.random()}`;
                        if (hasError) {
                            controller.error(`[${address}:${portWithRandomLog}] ${message} `);
                        }// 连接远程 TCP 服务器
                        remoteConnection = await rawTCPFactory(portRemote!, address!);
                        vlessResponseHeader = new Uint8Array([vlessVersion![0], 0]);// 构造 VLESS 协议响应头
                        const rawClientData = vlessBuffer.slice(rawDataIndex!);
                        // 将客户端发来的数据（不包括 VLESS 协议头部）发送到远程 TCP 服务器
                        await remoteConnection!.write(new Uint8Array(rawClientData));
                        // 远程连接已准备好，调用 remoteConnectionReadyResolve 函数
                        remoteConnectionReadyResolve(remoteConnection);
                    },
                    close() {
                    },
                    abort(reason) {
                    },
                })
            )
            .catch((error) => {
            });
        // 等待远程连接准备好
        await new Promise((resolve) => (remoteConnectionReadyResolve = resolve));
        let remoteChunkCount = 0;
        let totoal = 0;
        // 将远程 TCP 服务器的数据流发送回客户端的 WebSocket 连接中
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
                    send2WebSocket();
                },
                close() {
                },
                abort(reason) {
                    closeWebSocket(webSocket);
                },
            })
        );
    } catch (error: any) {
        closeWebSocket(webSocket);
    }
    return;
}
// 从客户端的 WebSocket 连接中读取数据并发送到远程 TCP 服务器
// ws --> remote
// 返回值：ReadableStream 对象
export function makeReadableWebSocketStream(
    ws: WebSocket | any,
    log: Function
) {
    let readableStreamCancel = false;
    return new ReadableStream < ArrayBuffer > ({
        // 开始读取数据
        start(controller) {
            ws.addEventListener('message', async (e: {
                data: ArrayBuffer
            }) => {
                const vlessBuffer: ArrayBuffer = e.data;

                controller.enqueue(vlessBuffer);
            });
            ws.addEventListener('error', (e: any) => {
                log('socket has error');
                readableStreamCancel = true;
                controller.error(e);
            });
            ws.addEventListener('close', () => {
                try {
                    log('webSocket is close');
                    if (readableStreamCancel) {
                        return;
                    }
                    controller.close();
                } catch (error) {
                    log(`websocketStream can't close DUE to `, error);
                }
            });
        },
        // 拉取数据（本函数中为空函数）
        pull(controller) {},
        // 取消数据读取
        cancel(reason) {
            log(`websocketStream is cancel DUE to `, reason);
            if (readableStreamCancel) {
                return;
            }
            readableStreamCancel = true;
            closeWebSocket(ws);
        },
    });
}
// 关闭 WebSocket 连接
// 参数：WebSocket 对象
export function closeWebSocket(socket: WebSocket | any) {
    if (socket.readyState === socket.OPEN) {
        socket.close();
    }
}

/*
函数名称：processVlessHeader
函数描述：处理VLESS协议头部信息
参数：
vlessBuffer: ArrayBuffer类型，VLESS协议头部数据
userID: string类型，用户ID
uuidLib: any类型，uuid库
lodash: any类型，lodash库
返回值：
Object类型，包含以下属性：
hasError: boolean类型，表示是否存在错误
message: string类型，存在错误时的错误信息
addressRemote: string类型，远程地址
portRemote: number类型，远程端口
rawDataIndex: number类型，原始数据索引
vlessVersion: Uint8Array类型，VLESS协议版本
*/
export function processVlessHeader(
    vlessBuffer: ArrayBuffer,
    userID: string,
    uuidLib: any,
    lodash: any
) {
    if (vlessBuffer.byteLength < 24) {
        return {
            hasError: true,
            message: 'invalid data',
        };
    }
    const version = new Uint8Array(vlessBuffer.slice(0, 1));
    let isValidUser = false;
    if (uuidLib.stringify(new Uint8Array(vlessBuffer.slice(1, 17))) === userID) {
        isValidUser = true;
    }
    if (!isValidUser) {
        return {
            hasError: true,
            message: 'in valid user',
        };
    }

    const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];

    const command = new Uint8Array(
        vlessBuffer.slice(18 + optLength, 18 + optLength + 1)
    )[0];
    if (command === 1) {} else {
        return {
            hasError: true,
            message: `command ${command} is not support, command 01-tcp,02-udp,03-mux`,
        };
    }
    const portIndex = 18 + optLength + 1;
    const portBuffer = vlessBuffer.slice(portIndex, portIndex + 2);
    const portRemote = new DataView(portBuffer).getInt16(0);

    let addressIndex = portIndex + 2;
    const addressBuffer = new Uint8Array(
        vlessBuffer.slice(addressIndex, addressIndex + 1)
    );

    const addressType = addressBuffer[0];
    let addressLength = 0;
    let addressValueIndex = addressIndex + 1;
    let addressValue = '';
    switch (addressType) {
        case 1:
            // 如果地址类型是 1，即 IPv4 地址
            addressLength = 4;
            // 地址长度为 4
            addressValue = new Uint8Array(
                vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
            ).join('.'); // 取出地址值并用点号拼接
            break;
        case 2:
            // 如果地址类型是 2，即域名
            addressLength = new Uint8Array(
                vlessBuffer.slice(addressValueIndex, addressValueIndex + 1)
            )[0];
            // 取出域名长度
            addressValueIndex += 1;
            // 更新地址值索引
            addressValue = new TextDecoder().decode(
                vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
            );
            // 取出域名并解码
            break;
        case 3:
            // 如果地址类型是 3，即 IPv6 地址
            addressLength = 16;
            // 地址长度为 16
            const addressChunkBy2: number[][] = lodash.chunk(
                new Uint8Array(
                    vlessBuffer.slice(
                        addressValueIndex,
                        addressValueIndex + addressLength
                    )
                ),
                2,
                null
            );
            // 将地址值按每 2 个字节分割为二维数组
            addressValue = addressChunkBy2
                .map((items) =>
                    items.map((item) => item.toString(16).padStart(2, '0')).join('')
                )
                .join(':'); // 将二维数组转为 IPv6 地址字符串
            if (addressValue) {
                addressValue = `[${addressValue}]`;
            }// 如果地址值非空，将其括在方括号中
            break;
        default:
    }
    if (!addressValue) {
        // 如果地址值为空
        return {
            hasError: true,
            message: `addressValue is empty, addressType is ${addressType}`,
        };// 返回错误信息
    }
    // 如果地址值非空，继续执行
    return {
        hasError: false,
        addressRemote: addressValue,
        portRemote,
        rawDataIndex: addressValueIndex + addressLength,
        vlessVersion: version,
    };
}
// 返回解析出的地址和端口信息
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

    processWebSocket({ // 处理 WebSocket 连接
        userID,
        webSocket: socket,
        rawTCPFactory: (port: number, hostname: string) => { // 创建 TCP 连接
            return Deno.connect({
                port,
                hostname,
            });
        },
        libs: { // 依赖库
            uuid,
            lodash
        },
    });
    return response; // 返回 WebSocket 响应
};

// 在页面即将卸载和已经卸载时输出日志
globalThis.addEventListener('beforeunload', (e) => {
    console.log('About to exit...');
});

globalThis.addEventListener('unload', (e) => {
    console.log('Exiting');
});

// 启动服务器
serve(handler, {
    port: 8080,
    hostname: '0.0.0.0'
});