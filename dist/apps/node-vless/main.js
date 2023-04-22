/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/app/utils.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.serverIndexPage = exports.index401 = exports.serverStaticFile = void 0;
const node_fs_1 = __webpack_require__("node:fs");
const node_path_1 = __webpack_require__("node:path");
const pretty_cache_header_1 = __webpack_require__("pretty-cache-header");
const mimeLookup = {
    '.js': 'application/javascript,charset=UTF-8',
    '.html': 'text/html,charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
};
const staticPath = 'dist/apps/cf-page/';
const file401 = 'dist/apps/node-vless/assets/401.html';
let filepath = null;
function serverStaticFile(req, resp) {
    const url = new URL(req.url, `http://${req.headers['host']}`);
    let fileurl = url.pathname;
    fileurl = (0, node_path_1.join)(staticPath, fileurl);
    console.log('....', fileurl);
    filepath = (0, node_path_1.resolve)(fileurl);
    console.log(filepath);
    if ((0, node_fs_1.existsSync)(filepath)) {
        let fileExt = (0, node_path_1.extname)(filepath);
        console.log('fileExt', fileExt);
        let mimeType = mimeLookup[fileExt];
        resp.writeHead(200, {
            'Content-Type': mimeType,
            'Cache-Control': (0, pretty_cache_header_1.cacheHeader)({
                public: true,
                maxAge: '1year',
                staleWhileRevalidate: '1year',
            }),
        });
        return (0, node_fs_1.createReadStream)(filepath).pipe(resp);
    }
    else {
        resp.writeHead(404);
        resp.write('not found');
        resp.end();
        return resp;
    }
}
exports.serverStaticFile = serverStaticFile;
function index401(req, resp) {
    const file401Path = (0, node_path_1.resolve)(file401);
    if ((0, node_fs_1.existsSync)(file401Path)) {
        (0, node_fs_1.createReadStream)(file401Path).pipe(resp);
    }
    else {
        resp.writeHead(401);
        resp.write('UUID env not set');
        resp.end();
    }
}
exports.index401 = index401;
function serverIndexPage(req, resp, uuid) {
    // if()
}
exports.serverIndexPage = serverIndexPage;


/***/ }),

/***/ "../../libs/vless-js/src/index.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.processVlessHeader = exports.closeWebSocket = exports.makeReadableWebSocketStream = exports.delay = void 0;
var vless_js_1 = __webpack_require__("../../libs/vless-js/src/lib/vless-js.ts");
Object.defineProperty(exports, "delay", ({ enumerable: true, get: function () { return vless_js_1.delay; } }));
Object.defineProperty(exports, "makeReadableWebSocketStream", ({ enumerable: true, get: function () { return vless_js_1.makeReadableWebSocketStream; } }));
Object.defineProperty(exports, "closeWebSocket", ({ enumerable: true, get: function () { return vless_js_1.closeWebSocket; } }));
Object.defineProperty(exports, "processVlessHeader", ({ enumerable: true, get: function () { return vless_js_1.processVlessHeader; } }));


/***/ }),

/***/ "../../libs/vless-js/src/lib/vless-js.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.processVlessHeader = exports.closeWebSocket = exports.makeReadableWebSocketStream = exports.delay = exports.vlessJs = void 0;
const tslib_1 = __webpack_require__("tslib");
const uuid_1 = __webpack_require__("uuid");
function vlessJs() {
    return 'vless-js';
}
exports.vlessJs = vlessJs;
function delay(ms) {
    return new Promise((resolve, rej) => {
        setTimeout(resolve, ms);
    });
}
exports.delay = delay;
function makeReadableWebSocketStream(ws, earlyDataHeader, log) {
    let readableStreamCancel = false;
    return new ReadableStream({
        start(controller) {
            ws.addEventListener('message', (e) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                // is stream is cancel, skip controller.enqueue
                if (readableStreamCancel) {
                    return;
                }
                const vlessBuffer = e.data;
                // console.log('MESSAGE', vlessBuffer);
                // console.log(`message is ${vlessBuffer.byteLength}`);
                // this is not backpressure, but backpressure is depends on underying websocket can pasue
                // https://streams.spec.whatwg.org/#example-rs-push-backpressure
                controller.enqueue(vlessBuffer);
            }));
            ws.addEventListener('error', (e) => {
                log('socket has error');
                readableStreamCancel = true;
                controller.error(e);
            });
            ws.addEventListener('close', () => {
                try {
                    log('webSocket is close');
                    // is stream is cancel, skip controller.close
                    if (readableStreamCancel) {
                        return;
                    }
                    controller.close();
                }
                catch (error) {
                    log(`websocketStream can't close DUE to `, error);
                }
            });
            // header ws 0rtt
            const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
            if (error) {
                log(`earlyDataHeader has invaild base64`);
                closeWebSocket(ws);
                return;
            }
            if (earlyData) {
                controller.enqueue(earlyData);
            }
        },
        pull(controller) {
            // if ws can stop read if stream is full, we can implement backpressure
            // https://streams.spec.whatwg.org/#example-rs-push-backpressure
        },
        cancel(reason) {
            // TODO: log can be remove, if writestream has error, write stream will has log
            log(`websocketStream is cancel DUE to `, reason);
            if (readableStreamCancel) {
                return;
            }
            readableStreamCancel = true;
            closeWebSocket(ws);
        },
    });
}
exports.makeReadableWebSocketStream = makeReadableWebSocketStream;
function base64ToArrayBuffer(base64Str) {
    if (!base64Str) {
        return { error: null };
    }
    try {
        // go use modified Base64 for URL rfc4648 which js atob not support
        base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
        const decode = atob(base64Str);
        const arryBuffer = Uint8Array.from(decode, (c) => c.charCodeAt(0));
        return { earlyData: arryBuffer.buffer, error: null };
    }
    catch (error) {
        return { error };
    }
}
function closeWebSocket(socket) {
    if (socket.readyState === socket.OPEN) {
        socket.close();
    }
}
exports.closeWebSocket = closeWebSocket;
//https://github.com/v2ray/v2ray-core/issues/2636
// 1 字节	  16 字节       1 字节	       M 字节	              1 字节            2 字节      1 字节	      S 字节	      X 字节
// 协议版本	  等价 UUID	  附加信息长度 M	(附加信息 ProtoBuf)  指令(udp/tcp)	    端口	      地址类型      地址	        请求数据
// 00                   00                                  01                 01bb(443)   02(ip/host)
// 1 字节	              1 字节	      N 字节	         Y 字节
// 协议版本，与请求的一致	附加信息长度 N	附加信息 ProtoBuf	响应数据
function processVlessHeader(vlessBuffer, userID
// uuidLib: any,
// lodash: any
) {
    if (vlessBuffer.byteLength < 24) {
        // console.log('invalid data');
        // controller.error('invalid data');
        return {
            hasError: true,
            message: 'invalid data',
        };
    }
    const version = new Uint8Array(vlessBuffer.slice(0, 1));
    let isValidUser = false;
    let isUDP = false;
    if ((0, uuid_1.stringify)(new Uint8Array(vlessBuffer.slice(1, 17))) === userID) {
        isValidUser = true;
    }
    if (!isValidUser) {
        // console.log('in valid user');
        // controller.error('in valid user');
        return {
            hasError: true,
            message: 'invalid user',
        };
    }
    const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
    //skip opt for now
    const command = new Uint8Array(vlessBuffer.slice(18 + optLength, 18 + optLength + 1))[0];
    // 0x01 TCP
    // 0x02 UDP
    // 0x03 MUX
    if (command === 1) {
    }
    else if (command === 2) {
        isUDP = true;
    }
    else {
        return {
            hasError: true,
            message: `command ${command} is not support, command 01-tcp,02-udp,03-mux`,
        };
    }
    const portIndex = 18 + optLength + 1;
    const portBuffer = vlessBuffer.slice(portIndex, portIndex + 2);
    // port is big-Endian in raw data etc 80 == 0x005d
    const portRemote = new DataView(portBuffer).getInt16(0);
    let addressIndex = portIndex + 2;
    const addressBuffer = new Uint8Array(vlessBuffer.slice(addressIndex, addressIndex + 1));
    // 1--> ipv4  addressLength =4
    // 2--> domain name addressLength=addressBuffer[1]
    // 3--> ipv6  addressLength =16
    const addressType = addressBuffer[0];
    let addressLength = 0;
    let addressValueIndex = addressIndex + 1;
    let addressValue = '';
    switch (addressType) {
        case 1:
            addressLength = 4;
            addressValue = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join('.');
            break;
        case 2:
            addressLength = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + 1))[0];
            addressValueIndex += 1;
            addressValue = new TextDecoder().decode(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
            break;
        case 3:
            addressLength = 16;
            const dataView = new DataView(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
            // 2001:0db8:85a3:0000:0000:8a2e:0370:7334
            const ipv6 = [];
            for (let i = 0; i < 8; i++) {
                ipv6.push(dataView.getUint16(i * 2).toString(16));
            }
            addressValue = ipv6.join(':');
            // console.log('---------', addressValue)
            // seems no need add [] for ipv6
            // if (addressValue) {
            //   addressValue = `[${addressValue}]`;
            // }
            break;
        default:
            console.log(`invild  addressType is ${addressType}`);
    }
    if (!addressValue) {
        // console.log(`[${address}:${port}] addressValue is empty`);
        // controller.error(`[${address}:${portWithRandomLog}] addressValue is empty`);
        return {
            hasError: true,
            message: `addressValue is empty, addressType is ${addressType}`,
        };
    }
    return {
        hasError: false,
        addressRemote: addressValue,
        portRemote,
        rawDataIndex: addressValueIndex + addressLength,
        vlessVersion: version,
        isUDP,
    };
}
exports.processVlessHeader = processVlessHeader;


/***/ }),

/***/ "pretty-cache-header":
/***/ ((module) => {

module.exports = require("pretty-cache-header");

/***/ }),

/***/ "tslib":
/***/ ((module) => {

module.exports = require("tslib");

/***/ }),

/***/ "uuid":
/***/ ((module) => {

module.exports = require("uuid");

/***/ }),

/***/ "ws":
/***/ ((module) => {

module.exports = require("ws");

/***/ }),

/***/ "http":
/***/ ((module) => {

module.exports = require("http");

/***/ }),

/***/ "node:dgram":
/***/ ((module) => {

module.exports = require("node:dgram");

/***/ }),

/***/ "node:dns":
/***/ ((module) => {

module.exports = require("node:dns");

/***/ }),

/***/ "node:fs":
/***/ ((module) => {

module.exports = require("node:fs");

/***/ }),

/***/ "node:net":
/***/ ((module) => {

module.exports = require("node:net");

/***/ }),

/***/ "node:path":
/***/ ((module) => {

module.exports = require("node:path");

/***/ }),

/***/ "node:stream/web":
/***/ ((module) => {

module.exports = require("node:stream/web");

/***/ }),

/***/ "stream":
/***/ ((module) => {

module.exports = require("stream");

/***/ }),

/***/ "url":
/***/ ((module) => {

module.exports = require("url");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__("tslib");
const http_1 = __webpack_require__("http");
const url_1 = __webpack_require__("url");
const ws_1 = __webpack_require__("ws");
const utils_1 = __webpack_require__("./src/app/utils.ts");
const uuid_1 = __webpack_require__("uuid");
const node_fs_1 = __webpack_require__("node:fs");
const node_dns_1 = __webpack_require__("node:dns");
const node_dgram_1 = __webpack_require__("node:dgram");
const vless_js_1 = __webpack_require__("../../libs/vless-js/src/index.ts");
const node_net_1 = __webpack_require__("node:net");
const stream_1 = __webpack_require__("stream");
const web_1 = __webpack_require__("node:stream/web");
const port = process.env.PORT;
const userID = process.env.UUID || '';
//'ipv4first' or 'verbatim'
const dnOder = process.env.DNSORDER || 'verbatim';
if (dnOder === 'ipv4first') {
    (0, node_dns_1.setDefaultResultOrder)(dnOder);
}
let isVaildUser = (0, uuid_1.validate)(userID);
if (!isVaildUser) {
    console.log('not set valid UUID');
}
const server = (0, http_1.createServer)((req, resp) => {
    var _a;
    if (!isVaildUser) {
        return (0, utils_1.index401)(req, resp);
    }
    const url = new URL(req.url, `http://${req.headers['host']}`);
    // health check
    if (req.method === 'GET' && url.pathname.startsWith('/health')) {
        resp.writeHead(200);
        resp.write('health 200');
        resp.end();
        return;
    }
    // index page
    if (url.pathname.includes(userID)) {
        const index = 'dist/apps/cf-page/index.html';
        resp.writeHead(200, {
            'Content-Type': 'text/html,charset=UTF-8',
        });
        return (0, node_fs_1.createReadStream)(index).pipe(resp);
    }
    if (req.method === 'GET' && url.pathname.startsWith('/assets')) {
        return (0, utils_1.serverStaticFile)(req, resp);
    }
    const basicAuth = req.headers.authorization || '';
    const authStringBase64 = ((_a = basicAuth.split(' ')) === null || _a === void 0 ? void 0 : _a[1]) || '';
    const authString = Buffer.from(authStringBase64, 'base64').toString('ascii');
    if (authString && authString.includes(userID)) {
        resp.writeHead(302, {
            'content-type': 'text/html; charset=utf-8',
            Location: `./${userID}`,
        });
        resp.end();
    }
    else {
        resp.writeHead(401, {
            'content-type': 'text/html; charset=utf-8',
            'WWW-Authenticate': 'Basic',
        });
        resp.end();
    }
});
const vlessWServer = new ws_1.WebSocketServer({ noServer: true });
vlessWServer.on('connection', function connection(ws, request) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        let address = '';
        let portWithRandomLog = '';
        try {
            const log = (info, event) => {
                console.log(`[${address}:${portWithRandomLog}] ${info}`, event || '');
            };
            let remoteConnection = null;
            let udpClientStream = null;
            let remoteConnectionReadyResolve;
            const earlyDataHeader = request.headers['sec-websocket-protocol'];
            const readableWebSocketStream = (0, vless_js_1.makeReadableWebSocketStream)(ws, earlyDataHeader, log);
            let vlessResponseHeader = null;
            // ws  --> remote
            readableWebSocketStream
                .pipeTo(new web_1.WritableStream({
                write(chunk, controller) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        if (!Buffer.isBuffer(chunk)) {
                            chunk = Buffer.from(chunk);
                        }
                        if (udpClientStream) {
                            const writer = udpClientStream.writable.getWriter();
                            // nodejs buffer to ArrayBuffer issue
                            // https://nodejs.org/dist/latest-v18.x/docs/api/buffer.html#bufbuffer
                            yield writer.write(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.length));
                            writer.releaseLock();
                            return;
                        }
                        if (remoteConnection) {
                            yield socketAsyncWrite(remoteConnection, chunk);
                            // remoteConnection.write(chunk);
                            return;
                        }
                        const vlessBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.length);
                        const { hasError, message, portRemote, addressRemote, rawDataIndex, vlessVersion, isUDP, } = (0, vless_js_1.processVlessHeader)(vlessBuffer, userID);
                        address = addressRemote || '';
                        portWithRandomLog = `${portRemote}--${Math.random()} ${isUDP ? 'udp ' : 'tcp '} `;
                        if (hasError) {
                            controller.error(`[${address}:${portWithRandomLog}] ${message} `);
                        }
                        // const addressType = requestAddr >> 42
                        // const addressLength = requestAddr & 0x0f;
                        console.log(`[${address}:${portWithRandomLog}] connecting`);
                        vlessResponseHeader = new Uint8Array([vlessVersion[0], 0]);
                        const rawClientData = vlessBuffer.slice(rawDataIndex);
                        if (isUDP) {
                            udpClientStream = makeUDPSocketStream(portRemote, address);
                            const writer = udpClientStream.writable.getWriter();
                            writer.write(rawClientData).catch((error) => console.log);
                            writer.releaseLock();
                            remoteConnectionReadyResolve(udpClientStream);
                        }
                        else {
                            remoteConnection = yield connect2Remote(portRemote, address, log);
                            remoteConnection.write(new Uint8Array(rawClientData));
                            remoteConnectionReadyResolve(remoteConnection);
                        }
                    });
                },
                close() {
                    // if (udpClientStream ) {
                    //   udpClientStream.writable.close();
                    // }
                    console.log(`[${address}:${portWithRandomLog}] readableWebSocketStream is close`);
                },
                abort(reason) {
                    // TODO: log can be remove, abort will catch by catch block
                    console.log(`[${address}:${portWithRandomLog}] readableWebSocketStream is abort`, JSON.stringify(reason));
                },
            }))
                .catch((error) => {
                console.error(`[${address}:${portWithRandomLog}] readableWebSocketStream pipeto has exception`, error.stack || error);
                // error is cancel readable stream anyway, no need close websocket in here
                // closeWebSocket(webSocket);
                // close remote conn
                // remoteConnection?.close();
            });
            yield new Promise((resolve) => (remoteConnectionReadyResolve = resolve));
            // remote --> ws
            let responseStream = udpClientStream === null || udpClientStream === void 0 ? void 0 : udpClientStream.readable;
            if (remoteConnection) {
                responseStream = stream_1.Readable.toWeb(remoteConnection);
            }
            // if readable not pipe can't wait fro writeable write method
            yield responseStream.pipeTo(new web_1.WritableStream({
                start() {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(vlessResponseHeader);
                    }
                },
                write(chunk, controller) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        // console.log('ws write', chunk);
                        if (ws.readyState === ws.OPEN) {
                            yield wsAsyncWrite(ws, chunk);
                        }
                    });
                },
                close() {
                    console.log(`[${address}:${portWithRandomLog}] remoteConnection!.readable is close`);
                },
                abort(reason) {
                    (0, vless_js_1.closeWebSocket)(ws);
                    console.error(`[${address}:${portWithRandomLog}] remoteConnection!.readable abort`, reason);
                },
            }));
        }
        catch (error) {
            console.error(`[${address}:${portWithRandomLog}] processWebSocket has exception `, error.stack || error);
            (0, vless_js_1.closeWebSocket)(ws);
        }
    });
});
server.on('upgrade', function upgrade(request, socket, head) {
    const { pathname } = (0, url_1.parse)(request.url);
    vlessWServer.handleUpgrade(request, socket, head, function done(ws) {
        vlessWServer.emit('connection', ws, request);
    });
});
server.listen({
    port: port,
    host: '0.0.0.0',
}, () => {
    console.log(`server listen in http://127.0.0.1:${port}`);
});
function connect2Remote(port, host, log) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        return new Promise((resole, reject) => {
            const remoteSocket = (0, node_net_1.connect)({
                port: port,
                host: host,
                // https://github.com/nodejs/node/pull/46587
                // autoSelectFamily: true,
            }, () => {
                log(`connected`);
                resole(remoteSocket);
            });
            remoteSocket.addListener('error', () => {
                reject('remoteSocket has error');
            });
        });
    });
}
function socketAsyncWrite(ws, chunk) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            ws.write(chunk, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve('');
                }
            });
        });
    });
}
function wsAsyncWrite(ws, chunk) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        // 20m not transmitted to the network
        while (ws.bufferedAmount > 1024 * 20) {
            yield (0, vless_js_1.delay)(10);
        }
        return new Promise((resolve, reject) => {
            ws.send(chunk, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve('');
                }
            });
        });
    });
}
function makeUDPSocketStream(portRemote, address) {
    const udpClient = (0, node_dgram_1.createSocket)('udp4');
    const transformStream = new web_1.TransformStream({
        start(controller) {
            /* … */
            udpClient.on('message', (message, info) => {
                controller.enqueue(Buffer.concat([new Uint8Array([0, info.size]), message]));
            });
            udpClient.on('error', (error) => {
                console.log('udpClient error event', error);
                controller.error(error);
            });
        },
        transform(chunk, controller) {
            return tslib_1.__awaiter(this, void 0, void 0, function* () {
                //seems v2ray will use same web socket for dns query..
                //And v2ray will combine A record and AAAA record into one ws message and use 2 btye for dns query length
                for (let index = 0; index < chunk.byteLength;) {
                    const lengthBuffer = chunk.slice(index, index + 2);
                    const udpPakcetLength = new DataView(lengthBuffer).getInt16(0);
                    const udpData = new Uint8Array(chunk.slice(index + 2, index + 2 + udpPakcetLength));
                    index = index + 2 + udpPakcetLength;
                    yield new Promise((resolve, reject) => {
                        udpClient.send(udpData, portRemote, address, (err) => {
                            if (err) {
                                console.log('udps send error', err);
                                controller.error(`Failed to send UDP packet !! ${err}`);
                                safeCloseUDP(udpClient);
                            }
                            resolve(true);
                        });
                    });
                    index = index;
                }
                // console.log('dns chunk', chunk);
                // console.log(portRemote, address);
                // port is big-Endian in raw data etc 80 == 0x005d
            });
        },
        flush(controller) {
            safeCloseUDP(udpClient);
            controller.terminate();
        },
    });
    return transformStream;
}
function safeCloseUDP(client) {
    try {
        client.close();
    }
    catch (error) {
        console.log('error close udp', error);
    }
}

})();

var __webpack_export_target__ = exports;
for(var i in __webpack_exports__) __webpack_export_target__[i] = __webpack_exports__[i];
if(__webpack_exports__.__esModule) Object.defineProperty(__webpack_export_target__, "__esModule", { value: true });
/******/ })()
;
//# sourceMappingURL=main.js.map