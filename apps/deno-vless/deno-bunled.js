// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

function deferred() {
    let methods;
    let state = "pending";
    const promise = new Promise((resolve, reject)=>{
        methods = {
            async resolve (value) {
                await value;
                state = "fulfilled";
                resolve(value);
            },
            reject (reason) {
                state = "rejected";
                reject(reason);
            }
        };
    });
    Object.defineProperty(promise, "state", {
        get: ()=>state
    });
    return Object.assign(promise, methods);
}
function delay(ms, options = {}) {
    const { signal , persistent  } = options;
    if (signal?.aborted) {
        return Promise.reject(new DOMException("Delay was aborted.", "AbortError"));
    }
    return new Promise((resolve, reject)=>{
        const abort = ()=>{
            clearTimeout(i);
            reject(new DOMException("Delay was aborted.", "AbortError"));
        };
        const done = ()=>{
            signal?.removeEventListener("abort", abort);
            resolve();
        };
        const i = setTimeout(done, ms);
        signal?.addEventListener("abort", abort, {
            once: true
        });
        if (persistent === false) {
            try {
                Deno.unrefTimer(i);
            } catch (error) {
                if (!(error instanceof ReferenceError)) {
                    throw error;
                }
                console.error("`persistent` option is only available in Deno");
            }
        }
    });
}
class MuxAsyncIterator {
    #iteratorCount = 0;
    #yields = [];
    #throws = [];
    #signal = deferred();
    add(iterable) {
        ++this.#iteratorCount;
        this.#callIteratorNext(iterable[Symbol.asyncIterator]());
    }
    async #callIteratorNext(iterator) {
        try {
            const { value , done  } = await iterator.next();
            if (done) {
                --this.#iteratorCount;
            } else {
                this.#yields.push({
                    iterator,
                    value
                });
            }
        } catch (e) {
            this.#throws.push(e);
        }
        this.#signal.resolve();
    }
    async *iterate() {
        while(this.#iteratorCount > 0){
            await this.#signal;
            for(let i = 0; i < this.#yields.length; i++){
                const { iterator , value  } = this.#yields[i];
                yield value;
                this.#callIteratorNext(iterator);
            }
            if (this.#throws.length) {
                for (const e of this.#throws){
                    throw e;
                }
                this.#throws.length = 0;
            }
            this.#yields.length = 0;
            this.#signal = deferred();
        }
    }
    [Symbol.asyncIterator]() {
        return this.iterate();
    }
}
const ERROR_SERVER_CLOSED = "Server closed";
const INITIAL_ACCEPT_BACKOFF_DELAY = 5;
const MAX_ACCEPT_BACKOFF_DELAY = 1000;
class Server {
    #port;
    #host;
    #handler;
    #closed = false;
    #listeners = new Set();
    #acceptBackoffDelayAbortController = new AbortController();
    #httpConnections = new Set();
    #onError;
    constructor(serverInit){
        this.#port = serverInit.port;
        this.#host = serverInit.hostname;
        this.#handler = serverInit.handler;
        this.#onError = serverInit.onError ?? function(error) {
            console.error(error);
            return new Response("Internal Server Error", {
                status: 500
            });
        };
    }
    async serve(listener) {
        if (this.#closed) {
            throw new Deno.errors.Http(ERROR_SERVER_CLOSED);
        }
        this.#trackListener(listener);
        try {
            return await this.#accept(listener);
        } finally{
            this.#untrackListener(listener);
            try {
                listener.close();
            } catch  {}
        }
    }
    async listenAndServe() {
        if (this.#closed) {
            throw new Deno.errors.Http(ERROR_SERVER_CLOSED);
        }
        const listener = Deno.listen({
            port: this.#port ?? 80,
            hostname: this.#host ?? "0.0.0.0",
            transport: "tcp"
        });
        return await this.serve(listener);
    }
    async listenAndServeTls(certFile, keyFile) {
        if (this.#closed) {
            throw new Deno.errors.Http(ERROR_SERVER_CLOSED);
        }
        const listener = Deno.listenTls({
            port: this.#port ?? 443,
            hostname: this.#host ?? "0.0.0.0",
            certFile,
            keyFile,
            transport: "tcp"
        });
        return await this.serve(listener);
    }
    close() {
        if (this.#closed) {
            throw new Deno.errors.Http(ERROR_SERVER_CLOSED);
        }
        this.#closed = true;
        for (const listener of this.#listeners){
            try {
                listener.close();
            } catch  {}
        }
        this.#listeners.clear();
        this.#acceptBackoffDelayAbortController.abort();
        for (const httpConn of this.#httpConnections){
            this.#closeHttpConn(httpConn);
        }
        this.#httpConnections.clear();
    }
    get closed() {
        return this.#closed;
    }
    get addrs() {
        return Array.from(this.#listeners).map((listener)=>listener.addr);
    }
    async #respond(requestEvent, connInfo) {
        let response;
        try {
            response = await this.#handler(requestEvent.request, connInfo);
            if (response.bodyUsed && response.body !== null) {
                throw new TypeError("Response body already consumed.");
            }
        } catch (error) {
            response = await this.#onError(error);
        }
        try {
            await requestEvent.respondWith(response);
        } catch  {}
    }
    async #serveHttp(httpConn, connInfo1) {
        while(!this.#closed){
            let requestEvent;
            try {
                requestEvent = await httpConn.nextRequest();
            } catch  {
                break;
            }
            if (requestEvent === null) {
                break;
            }
            this.#respond(requestEvent, connInfo1);
        }
        this.#closeHttpConn(httpConn);
    }
    async #accept(listener) {
        let acceptBackoffDelay;
        while(!this.#closed){
            let conn;
            try {
                conn = await listener.accept();
            } catch (error) {
                if (error instanceof Deno.errors.BadResource || error instanceof Deno.errors.InvalidData || error instanceof Deno.errors.UnexpectedEof || error instanceof Deno.errors.ConnectionReset || error instanceof Deno.errors.NotConnected) {
                    if (!acceptBackoffDelay) {
                        acceptBackoffDelay = INITIAL_ACCEPT_BACKOFF_DELAY;
                    } else {
                        acceptBackoffDelay *= 2;
                    }
                    if (acceptBackoffDelay >= 1000) {
                        acceptBackoffDelay = MAX_ACCEPT_BACKOFF_DELAY;
                    }
                    try {
                        await delay(acceptBackoffDelay, {
                            signal: this.#acceptBackoffDelayAbortController.signal
                        });
                    } catch (err) {
                        if (!(err instanceof DOMException && err.name === "AbortError")) {
                            throw err;
                        }
                    }
                    continue;
                }
                throw error;
            }
            acceptBackoffDelay = undefined;
            let httpConn;
            try {
                httpConn = Deno.serveHttp(conn);
            } catch  {
                continue;
            }
            this.#trackHttpConnection(httpConn);
            const connInfo = {
                localAddr: conn.localAddr,
                remoteAddr: conn.remoteAddr
            };
            this.#serveHttp(httpConn, connInfo);
        }
    }
    #closeHttpConn(httpConn1) {
        this.#untrackHttpConnection(httpConn1);
        try {
            httpConn1.close();
        } catch  {}
    }
    #trackListener(listener1) {
        this.#listeners.add(listener1);
    }
    #untrackListener(listener2) {
        this.#listeners.delete(listener2);
    }
    #trackHttpConnection(httpConn2) {
        this.#httpConnections.add(httpConn2);
    }
    #untrackHttpConnection(httpConn3) {
        this.#httpConnections.delete(httpConn3);
    }
}
function hostnameForDisplay(hostname) {
    return hostname === "0.0.0.0" ? "localhost" : hostname;
}
async function serve(handler, options = {}) {
    let port = options.port ?? 8000;
    const hostname = options.hostname ?? "0.0.0.0";
    const server = new Server({
        port,
        hostname,
        handler,
        onError: options.onError
    });
    options?.signal?.addEventListener("abort", ()=>server.close(), {
        once: true
    });
    const s = server.listenAndServe();
    port = server.addrs[0].port;
    if ("onListen" in options) {
        options.onListen?.({
            port,
            hostname
        });
    } else {
        console.log(`Listening on http://${hostnameForDisplay(hostname)}:${port}/`);
    }
    return await s;
}
new Uint8Array(16);
var REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;
function validate(uuid) {
    return typeof uuid === 'string' && REGEX.test(uuid);
}
const byteToHex = [];
for(let i = 0; i < 256; ++i){
    byteToHex.push((i + 0x100).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
    return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
function stringify(arr, offset = 0) {
    const uuid = unsafeStringify(arr, offset);
    if (!validate(uuid)) {
        throw TypeError('Stringified UUID is invalid');
    }
    return uuid;
}
function parse(uuid) {
    if (!validate(uuid)) {
        throw TypeError('Invalid UUID');
    }
    let v;
    const arr = new Uint8Array(16);
    arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
    arr[1] = v >>> 16 & 0xff;
    arr[2] = v >>> 8 & 0xff;
    arr[3] = v & 0xff;
    arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
    arr[5] = v & 0xff;
    arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
    arr[7] = v & 0xff;
    arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
    arr[9] = v & 0xff;
    arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
    arr[11] = v / 0x100000000 & 0xff;
    arr[12] = v >>> 24 & 0xff;
    arr[13] = v >>> 16 & 0xff;
    arr[14] = v >>> 8 & 0xff;
    arr[15] = v & 0xff;
    return arr;
}
function stringToBytes(str) {
    str = unescape(encodeURIComponent(str));
    const bytes = [];
    for(let i = 0; i < str.length; ++i){
        bytes.push(str.charCodeAt(i));
    }
    return bytes;
}
const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const URL1 = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
function v35(name, version, hashfunc) {
    function generateUUID(value, namespace, buf, offset) {
        var _namespace;
        if (typeof value === 'string') {
            value = stringToBytes(value);
        }
        if (typeof namespace === 'string') {
            namespace = parse(namespace);
        }
        if (((_namespace = namespace) === null || _namespace === void 0 ? void 0 : _namespace.length) !== 16) {
            throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
        }
        let bytes = new Uint8Array(16 + value.length);
        bytes.set(namespace);
        bytes.set(value, namespace.length);
        bytes = hashfunc(bytes);
        bytes[6] = bytes[6] & 0x0f | version;
        bytes[8] = bytes[8] & 0x3f | 0x80;
        if (buf) {
            offset = offset || 0;
            for(let i = 0; i < 16; ++i){
                buf[offset + i] = bytes[i];
            }
            return buf;
        }
        return unsafeStringify(bytes);
    }
    try {
        generateUUID.name = name;
    } catch (err) {}
    generateUUID.DNS = DNS;
    generateUUID.URL = URL1;
    return generateUUID;
}
function md5(bytes) {
    if (typeof bytes === 'string') {
        const msg = unescape(encodeURIComponent(bytes));
        bytes = new Uint8Array(msg.length);
        for(let i = 0; i < msg.length; ++i){
            bytes[i] = msg.charCodeAt(i);
        }
    }
    return md5ToHexEncodedArray(wordsToMd5(bytesToWords(bytes), bytes.length * 8));
}
function md5ToHexEncodedArray(input) {
    const output = [];
    const length32 = input.length * 32;
    const hexTab = '0123456789abcdef';
    for(let i = 0; i < length32; i += 8){
        const x = input[i >> 5] >>> i % 32 & 0xff;
        const hex = parseInt(hexTab.charAt(x >>> 4 & 0x0f) + hexTab.charAt(x & 0x0f), 16);
        output.push(hex);
    }
    return output;
}
function getOutputLength(inputLength8) {
    return (inputLength8 + 64 >>> 9 << 4) + 14 + 1;
}
function wordsToMd5(x, len) {
    x[len >> 5] |= 0x80 << len % 32;
    x[getOutputLength(len) - 1] = len;
    let a = 1732584193;
    let b = -271733879;
    let c = -1732584194;
    let d = 271733878;
    for(let i = 0; i < x.length; i += 16){
        const olda = a;
        const oldb = b;
        const oldc = c;
        const oldd = d;
        a = md5ff(a, b, c, d, x[i], 7, -680876936);
        d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
        c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
        b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
        a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
        d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
        c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
        b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
        a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
        d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
        c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
        b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
        d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
        c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
        b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
        a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
        d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
        c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
        b = md5gg(b, c, d, a, x[i], 20, -373897302);
        a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
        d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
        c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
        b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
        d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
        c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
        b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
        a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
        d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
        c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
        b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
        a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
        d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
        c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
        b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
        d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
        c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
        b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
        a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
        d = md5hh(d, a, b, c, x[i], 11, -358537222);
        c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
        b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
        a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
        d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
        c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
        b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
        a = md5ii(a, b, c, d, x[i], 6, -198630844);
        d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
        c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
        b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
        a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
        d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
        c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
        b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
        a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
        d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
        c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
        b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
        d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
        c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
        b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
        a = safeAdd(a, olda);
        b = safeAdd(b, oldb);
        c = safeAdd(c, oldc);
        d = safeAdd(d, oldd);
    }
    return [
        a,
        b,
        c,
        d
    ];
}
function bytesToWords(input) {
    if (input.length === 0) {
        return [];
    }
    const length8 = input.length * 8;
    const output = new Uint32Array(getOutputLength(length8));
    for(let i = 0; i < length8; i += 8){
        output[i >> 5] |= (input[i / 8] & 0xff) << i % 32;
    }
    return output;
}
function safeAdd(x, y) {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return msw << 16 | lsw & 0xffff;
}
function bitRotateLeft(num, cnt) {
    return num << cnt | num >>> 32 - cnt;
}
function md5cmn(q, a, b, x, s, t) {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}
function md5ff(a, b, c, d, x, s, t) {
    return md5cmn(b & c | ~b & d, a, b, x, s, t);
}
function md5gg(a, b, c, d, x, s, t) {
    return md5cmn(b & d | c & ~d, a, b, x, s, t);
}
function md5hh(a, b, c, d, x, s, t) {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5ii(a, b, c, d, x, s, t) {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t);
}
v35('v3', 0x30, md5);
typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID.bind(crypto);
function f(s, x, y, z) {
    switch(s){
        case 0:
            return x & y ^ ~x & z;
        case 1:
            return x ^ y ^ z;
        case 2:
            return x & y ^ x & z ^ y & z;
        case 3:
            return x ^ y ^ z;
    }
}
function ROTL(x, n) {
    return x << n | x >>> 32 - n;
}
function sha1(bytes) {
    const K = [
        0x5a827999,
        0x6ed9eba1,
        0x8f1bbcdc,
        0xca62c1d6
    ];
    const H = [
        0x67452301,
        0xefcdab89,
        0x98badcfe,
        0x10325476,
        0xc3d2e1f0
    ];
    if (typeof bytes === 'string') {
        const msg = unescape(encodeURIComponent(bytes));
        bytes = [];
        for(let i = 0; i < msg.length; ++i){
            bytes.push(msg.charCodeAt(i));
        }
    } else if (!Array.isArray(bytes)) {
        bytes = Array.prototype.slice.call(bytes);
    }
    bytes.push(0x80);
    const l = bytes.length / 4 + 2;
    const N = Math.ceil(l / 16);
    const M = new Array(N);
    for(let i = 0; i < N; ++i){
        const arr = new Uint32Array(16);
        for(let j = 0; j < 16; ++j){
            arr[j] = bytes[i * 64 + j * 4] << 24 | bytes[i * 64 + j * 4 + 1] << 16 | bytes[i * 64 + j * 4 + 2] << 8 | bytes[i * 64 + j * 4 + 3];
        }
        M[i] = arr;
    }
    M[N - 1][14] = (bytes.length - 1) * 8 / Math.pow(2, 32);
    M[N - 1][14] = Math.floor(M[N - 1][14]);
    M[N - 1][15] = (bytes.length - 1) * 8 & 0xffffffff;
    for(let i = 0; i < N; ++i){
        const W = new Uint32Array(80);
        for(let t = 0; t < 16; ++t){
            W[t] = M[i][t];
        }
        for(let t = 16; t < 80; ++t){
            W[t] = ROTL(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
        }
        let a = H[0];
        let b = H[1];
        let c = H[2];
        let d = H[3];
        let e = H[4];
        for(let t = 0; t < 80; ++t){
            const s = Math.floor(t / 20);
            const T = ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[t] >>> 0;
            e = d;
            d = c;
            c = ROTL(b, 30) >>> 0;
            b = a;
            a = T;
        }
        H[0] = H[0] + a >>> 0;
        H[1] = H[1] + b >>> 0;
        H[2] = H[2] + c >>> 0;
        H[3] = H[3] + d >>> 0;
        H[4] = H[4] + e >>> 0;
    }
    return [
        H[0] >> 24 & 0xff,
        H[0] >> 16 & 0xff,
        H[0] >> 8 & 0xff,
        H[0] & 0xff,
        H[1] >> 24 & 0xff,
        H[1] >> 16 & 0xff,
        H[1] >> 8 & 0xff,
        H[1] & 0xff,
        H[2] >> 24 & 0xff,
        H[2] >> 16 & 0xff,
        H[2] >> 8 & 0xff,
        H[2] & 0xff,
        H[3] >> 24 & 0xff,
        H[3] >> 16 & 0xff,
        H[3] >> 8 & 0xff,
        H[3] & 0xff,
        H[4] >> 24 & 0xff,
        H[4] >> 16 & 0xff,
        H[4] >> 8 & 0xff,
        H[4] & 0xff
    ];
}
v35('v5', 0x50, sha1);
async function serveClient(req, basePath) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/assets') || url.pathname.includes(basePath)) {
        let targetUrl = `https://raw.githubusercontent.com/zizifn/edgetunnel/main/dist/apps/cf-page${url.pathname}`;
        if (url.pathname.includes(basePath)) {
            targetUrl = `https://raw.githubusercontent.com/zizifn/edgetunnel/main/dist/apps/cf-page/index.html`;
        }
        console.log(targetUrl);
        const resp = await fetch(targetUrl);
        const modifiedHeaders = new Headers(resp.headers);
        modifiedHeaders.delete('content-security-policy');
        if (url.pathname.endsWith('.js')) {
            modifiedHeaders.set('content-type', 'application/javascript');
        } else if (url.pathname.endsWith('.css')) {
            modifiedHeaders.set('content-type', 'text/css');
        } else if (url.pathname.includes(basePath)) {
            modifiedHeaders.set('content-type', 'text/html; charset=utf-8');
        }
        return new Response(resp.body, {
            status: resp.status,
            headers: modifiedHeaders
        });
    }
    const basicAuth = req.headers.get('Authorization') || '';
    const authString = basicAuth.split(' ')?.[1] || '';
    if (atob(authString).includes(basePath)) {
        console.log('302');
        return new Response(``, {
            status: 302,
            headers: {
                'content-type': 'text/html; charset=utf-8',
                Location: `./${basePath}`
            }
        });
    } else {
        return new Response(``, {
            status: 401,
            headers: {
                'content-type': 'text/html; charset=utf-8',
                'WWW-Authenticate': 'Basic'
            }
        });
    }
}
function delay1(ms) {
    return new Promise((resolve, rej)=>{
        setTimeout(resolve, ms);
    });
}
function makeReadableWebSocketStream(ws, earlyDataHeader, log) {
    let readableStreamCancel = false;
    return new ReadableStream({
        start (controller) {
            ws.addEventListener('message', async (e)=>{
                if (readableStreamCancel) {
                    return;
                }
                const vlessBuffer = e.data;
                controller.enqueue(vlessBuffer);
            });
            ws.addEventListener('error', (e)=>{
                log('socket has error');
                readableStreamCancel = true;
                controller.error(e);
            });
            ws.addEventListener('close', ()=>{
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
            const { earlyData , error  } = base64ToArrayBuffer(earlyDataHeader);
            if (error) {
                log(`earlyDataHeader has invaild base64`);
                closeWebSocket(ws);
                return;
            }
            if (earlyData) {
                controller.enqueue(earlyData);
            }
        },
        pull (controller) {},
        cancel (reason) {
            log(`websocketStream is cancel DUE to `, reason);
            if (readableStreamCancel) {
                return;
            }
            readableStreamCancel = true;
            closeWebSocket(ws);
        }
    });
}
function base64ToArrayBuffer(base64Str) {
    if (!base64Str) {
        return {
            error: null
        };
    }
    try {
        base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
        const decode = atob(base64Str);
        const arryBuffer = Uint8Array.from(decode, (c)=>c.charCodeAt(0));
        return {
            earlyData: arryBuffer.buffer,
            error: null
        };
    } catch (error) {
        return {
            error
        };
    }
}
function closeWebSocket(socket) {
    if (socket.readyState === socket.OPEN) {
        socket.close();
    }
}
function processVlessHeader(vlessBuffer, userID) {
    if (vlessBuffer.byteLength < 24) {
        return {
            hasError: true,
            message: 'invalid data'
        };
    }
    const version = new Uint8Array(vlessBuffer.slice(0, 1));
    let isValidUser = false;
    let isUDP = false;
    if (stringify(new Uint8Array(vlessBuffer.slice(1, 17))) === userID) {
        isValidUser = true;
    }
    if (!isValidUser) {
        return {
            hasError: true,
            message: 'invalid user'
        };
    }
    const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
    const command = new Uint8Array(vlessBuffer.slice(18 + optLength, 18 + optLength + 1))[0];
    if (command === 1) {} else if (command === 2) {
        isUDP = true;
    } else {
        return {
            hasError: true,
            message: `command ${command} is not support, command 01-tcp,02-udp,03-mux`
        };
    }
    const portIndex = 18 + optLength + 1;
    const portBuffer = vlessBuffer.slice(portIndex, portIndex + 2);
    const portRemote = new DataView(portBuffer).getInt16(0);
    let addressIndex = portIndex + 2;
    const addressBuffer = new Uint8Array(vlessBuffer.slice(addressIndex, addressIndex + 1));
    const addressType = addressBuffer[0];
    let addressLength = 0;
    let addressValueIndex = addressIndex + 1;
    let addressValue = '';
    switch(addressType){
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
            const ipv6 = [];
            for(let i = 0; i < 8; i++){
                ipv6.push(dataView.getUint16(i * 2).toString(16));
            }
            addressValue = ipv6.join(':');
            break;
        default:
            console.log(`invild  addressType is ${addressType}`);
    }
    if (!addressValue) {
        return {
            hasError: true,
            message: `addressValue is empty, addressType is ${addressType}`
        };
    }
    return {
        hasError: false,
        addressRemote: addressValue,
        portRemote,
        rawDataIndex: addressValueIndex + addressLength,
        vlessVersion: version,
        isUDP
    };
}
const userID = Deno.env.get('UUID') || '';
let isVaildUser = validate(userID);
if (!isVaildUser) {
    console.log('not set valid UUID');
}
const handler = async (req)=>{
    if (!isVaildUser) {
        const index401 = await Deno.readFile(`${Deno.cwd()}/dist/apps/cf-page/401.html`);
        return new Response(index401, {
            status: 401,
            headers: {
                'content-type': 'text/html; charset=utf-8'
            }
        });
    }
    const upgrade = req.headers.get('upgrade') || '';
    if (upgrade.toLowerCase() != 'websocket') {
        return await serveClient(req, userID);
    }
    const { socket , response  } = Deno.upgradeWebSocket(req);
    socket.addEventListener('open', ()=>{});
    const earlyDataHeader = req.headers.get('sec-websocket-protocol') || '';
    processWebSocket({
        userID,
        webSocket: socket,
        earlyDataHeader
    });
    return response;
};
async function processWebSocket({ userID , webSocket , earlyDataHeader  }) {
    let address = '';
    let portWithRandomLog = '';
    let remoteConnection = null;
    let remoteConnectionReadyResolve;
    try {
        const log = (info, event)=>{
            console.log(`[${address}:${portWithRandomLog}] ${info}`, event || '');
        };
        const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyDataHeader, log);
        let vlessResponseHeader = null;
        readableWebSocketStream.pipeTo(new WritableStream({
            async write (chunk, controller) {
                const vlessBuffer = chunk;
                if (remoteConnection) {
                    await remoteConnection.write(new Uint8Array(vlessBuffer));
                    return;
                }
                const { hasError , message , portRemote , addressRemote , rawDataIndex , vlessVersion , isUDP  } = processVlessHeader(vlessBuffer, userID);
                address = addressRemote || '';
                portWithRandomLog = `${portRemote}--${Math.random()}`;
                if (isUDP) {
                    console.log('udp');
                    controller.error(`[${address}:${portWithRandomLog}] command udp is not support `);
                    return;
                }
                if (hasError) {
                    controller.error(`[${address}:${portWithRandomLog}] ${message} `);
                }
                console.log(`[${address}:${portWithRandomLog}] connecting`);
                remoteConnection = await Deno.connect({
                    port: portRemote,
                    hostname: address
                });
                vlessResponseHeader = new Uint8Array([
                    vlessVersion[0],
                    0
                ]);
                const rawClientData = vlessBuffer.slice(rawDataIndex);
                await remoteConnection.write(new Uint8Array(rawClientData));
                remoteConnectionReadyResolve(remoteConnection);
            },
            close () {
                console.log(`[${address}:${portWithRandomLog}] readableWebSocketStream is close`);
            },
            abort (reason) {
                console.log(`[${address}:${portWithRandomLog}] readableWebSocketStream is abort`, JSON.stringify(reason));
            }
        })).catch((error)=>{
            console.error(`[${address}:${portWithRandomLog}] readableWebSocketStream pipeto has exception`, error.stack || error);
        });
        await new Promise((resolve)=>remoteConnectionReadyResolve = resolve);
        let remoteChunkCount = 0;
        await remoteConnection.readable.pipeTo(new WritableStream({
            start () {
                if (webSocket.readyState === webSocket.OPEN) {
                    webSocket.send(vlessResponseHeader);
                }
            },
            async write (chunk, controller) {
                function send2WebSocket() {
                    if (webSocket.readyState !== webSocket.OPEN) {
                        controller.error(`can't accept data from remoteConnection!.readable when client webSocket is close early`);
                        return;
                    }
                    webSocket.send(chunk);
                }
                remoteChunkCount++;
                if (remoteChunkCount < 20) {
                    send2WebSocket();
                } else if (remoteChunkCount < 120) {
                    await delay1(10);
                    send2WebSocket();
                } else if (remoteChunkCount < 500) {
                    await delay1(20);
                    send2WebSocket();
                } else {
                    await delay1(50);
                    send2WebSocket();
                }
            },
            close () {
                console.log(`[${address}:${portWithRandomLog}] remoteConnection!.readable is close`);
            },
            abort (reason) {
                closeWebSocket(webSocket);
                console.error(`[${address}:${portWithRandomLog}] remoteConnection!.readable abort`, reason);
            }
        }));
    } catch (error) {
        console.error(`[${address}:${portWithRandomLog}] processWebSocket has exception `, error.stack || error);
        closeWebSocket(webSocket);
    }
    return;
}
globalThis.addEventListener('beforeunload', (e)=>{
    console.log('About to exit...');
});
globalThis.addEventListener('unload', (e)=>{
    console.log('Exiting');
});
serve(handler, {
    port: 8080,
    hostname: '0.0.0.0'
});
