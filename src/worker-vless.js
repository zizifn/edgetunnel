import { connect } from 'cloudflare:sockets';

// How to generate your own UUID:
// [Windows] Press "Win + R", input cmd and run:  Powershell -NoExit -Command "[guid]::NewGuid()"
const userID = 'd342d11e-d424-4583-b36e-524ab1f0afa4';

// 1. 如果这个你不填写，并且你客户端的 IP 不是 China IP，那么就自动取你的客户端IP。有一定概率会失败。
// 2. 如果你指定，忽略一切条件，用你指定的IP。
let proxyIP = '';

// The list of domains covered by Cloudflare's Bringing-Your-Own plan. Manual maintenance required.
// https://developers.cloudflare.com/byoip/
const byoListCommon = [
	'render.com', 'chat.openai.com', 'docker.com', 'speedtest.net'
];
const  byoListUnCommon= ['shop.bbc.com']; 

const byoList = byoListCommon.concat(byoListUnCommon);

if (!isValidUUID(userID)) {
	throw new Error('uuid is not valid');
}

export default {
	/**
	 * @param {import("@cloudflare/workers-types").Request} request
	 * @param {{uuid: string}} env
	 * @param {import("@cloudflare/workers-types").ExecutionContext} ctx
	 * @returns {Promise<Response>}
	 */
	async fetch(request, env, ctx) {
		try {
			const upgradeHeader = request.headers.get('Upgrade');
			if (!upgradeHeader || upgradeHeader !== 'websocket') {
				const url = new URL(request.url);
				switch (url.pathname) {
					case '/':
						return new Response(JSON.stringify(request.cf), { status: 200 });
					default:
						return new Response('Not found', { status: 404 });
				}
			} else {
				return await vlessOverWSHandler(request);
			}
		} catch (err) {
			/** @type {Error} */ let e = err;
			return new Response(e.toString());
		}
	},
};




/**
 * 
 * @param {import("@cloudflare/workers-types").Request} request
 */
async function vlessOverWSHandler(request) {

	const webSocketPair = new WebSocketPair();
	/** @type {import("@cloudflare/workers-types").WebSocket[]} */
	const [client, webSocket] = Object.values(webSocketPair);

	webSocket.accept();

	let address = '';
	let portWithRandomLog = '';
	const log = (info, event) => {
		console.log(`[${address}:${portWithRandomLog}] ${info}`, event || '');
	};
	const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';

	// only try to get client ip as redirect ip when client is not in China
	const clientIP = getClientIp(request);

	const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyDataHeader, log);

	/** @type {import("@cloudflare/workers-types").Socket | null}*/
	let remoteSocket = null;

	// ws --> remote
	readableWebSocketStream.pipeTo(new WritableStream({
		async write(chunk, controller) {
			if (remoteSocket) {
				const writer = remoteSocket.writable.getWriter()
				await writer.write(chunk);
				writer.releaseLock();
				return;
			}

			const {
				hasError,
				message,
				portRemote,
				addressRemote = '',
				addressType = 2,
				rawDataIndex,
				vlessVersion = new Uint8Array([0, 0]),
				isUDP,
			} = processVlessHeader(chunk, userID);
			address = addressRemote;
			portWithRandomLog = `${portRemote}--${Math.random()} ${isUDP ? 'udp ' : 'tcp '
				} `;
			// if UDP but port not DNS port, close it
			if (isUDP && portRemote !== 53) {
				// controller.error('UDP proxy only enable for DNS which is port 53');
				throw new Error('UDP proxy only enable for DNS which is port 53'); // cf seems has bug, controller.error will not end stream
				return;
			}
			if (hasError) {
				console.log('----------------------hasError----------', message);
				// throw new Error(message);
				// controller.error(message);
				throw new Error(message); // cf seems has bug, controller.error will not end stream
				// webSocket.close(1000, message);
				return;
			}
			const vlessResponseHeader = new Uint8Array([vlessVersion[0], 0]);
			const rawClientData = chunk.slice(rawDataIndex);
			// get remote address IP
			let redirectIp = '';
			if (isUDP) {
				redirectIp = '8.8.4.4';
			} else {
				redirectIp = await getRedirectIpForCFWebsite(addressType, addressRemote, clientIP);
			}
			const tcpSocket = connect({
				hostname: redirectIp || addressRemote,
				port: portRemote,
			});
			remoteSocket = tcpSocket;
			log(`connected to ${redirectIp || addressRemote}`);
			const writer = tcpSocket.writable.getWriter();
			await writer.write(rawClientData); // first write, nomal is tls client hello
			writer.releaseLock();

			// when remoteSocket is ready, pass to websocket
			// remote--> ws
			remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, isUDP, log)
			// let remoteConnectionReadyResolve = null;
			// remoteConnectionReadyResolve(tcpSocket);
		},
		close() {
			log(`readableWebSocketStream is close`);
		},
		abort(reason) {
			log(`readableWebSocketStream is abort`, JSON.stringify(reason));
		},
	})).catch((err) => {
		log('readableWebSocketStream pipeTo error', err);
	});

	return new Response(null, {
		status: 101,
		webSocket: client,
	});
}


/**
 * 
 * @param {number} addressType 
 * @param {string} addressRemote 
 * @param {string} clientIP 
 * @returns 
 */
async function getRedirectIpForCFWebsite(addressType, addressRemote, clientIP) {
	let redirectIp = '';
	// due to cf connect method can't connect cf own ip, so we use proxy ip
	const isCFIp = await isCloudFlareIP(addressType, addressRemote);
	if (isCFIp) {
		redirectIp = proxyIP || clientIP;
		console.log(`is cf ip ${addressRemote} redirect to ${redirectIp || '<not found any redirectIp>'}`);
	}
	return redirectIp;
}

/**
 * 
 * @param {import("@cloudflare/workers-types").WebSocket} webSocketServer
 * @param {string} earlyDataHeader for ws 0rtt
 * @param {(info: string)=> void} log for ws 0rtt
 */
function makeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
	let readableStreamCancel = false;
	const stream = new ReadableStream({
		start(controller) {
			webSocketServer.addEventListener('message', (event) => {
				if (readableStreamCancel) {
					return;
				}
				const message = event.data;
				controller.enqueue(message);
			});

			// The event means that the client closed the client -> server stream.
			// However, the server -> client stream is still open until you call close() on the server side.
			// The WebSocket protocol says that a separate close message must be sent in each direction to fully close the socket.
			webSocketServer.addEventListener('close', () => {
				// client send close, need close server
				// is stream is cancel, skip controller.close
				safeCloseWebSocket(webSocketServer);
				if (readableStreamCancel) {
					return;
				}
				controller.close();
			}
			);
			webSocketServer.addEventListener('error', (err) => {
				log('webSocketServer has error');
				controller.error(err);
			}
			);
			// for ws 0rtt
			const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
			if (error) {
				controller.error(error);
			} else if (earlyData) {
				controller.enqueue(earlyData);
			}
		},

		pull(controller) {
			// if ws can stop read if stream is full, we can implement backpressure
			// https://streams.spec.whatwg.org/#example-rs-push-backpressure
		},
		cancel(reason) {
			// 1. pipe WritableStream has error, this cancel will called, so ws handle server close into here
			// 2. if readableStream is cancel, all controller.close/enqueue need skip,
			// 3. but from testing controller.error still work even if readableStream is cancel
			if (readableStreamCancel) {
				return;
			}
			log(`ReadableStream was canceled, due to ${reason}`)
			readableStreamCancel = true;
			safeCloseWebSocket(webSocketServer);
		}
	});

	return stream;

}

//https://github.com/v2ray/v2ray-core/issues/2636
// https://github.com/zizifn/excalidraw-backup/blob/main/v2ray-protocol.excalidraw

/**
 * 
 * @param { ArrayBuffer} vlessBuffer 
 * @param {string} userID 
 * @returns 
 */
function processVlessHeader(
	vlessBuffer,
	userID
) {
	if (vlessBuffer.byteLength < 24) {
		return {
			hasError: true,
			message: 'invalid data',
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
			message: 'invalid user',
		};
	}

	const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
	//skip opt for now

	const command = new Uint8Array(
		vlessBuffer.slice(18 + optLength, 18 + optLength + 1)
	)[0];

	// 0x01 TCP
	// 0x02 UDP
	// 0x03 MUX
	if (command === 1) {
	} else if (command === 2) {
		isUDP = true;
	} else {
		return {
			hasError: true,
			message: `command ${command} is not support, command 01-tcp,02-udp,03-mux`,
		};
	}
	const portIndex = 18 + optLength + 1;
	const portBuffer = vlessBuffer.slice(portIndex, portIndex + 2);
	// port is big-Endian in raw data etc 80 == 0x005d
	const portRemote = new DataView(portBuffer).getUint16(0);

	let addressIndex = portIndex + 2;
	const addressBuffer = new Uint8Array(
		vlessBuffer.slice(addressIndex, addressIndex + 1)
	);

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
			addressValue = new Uint8Array(
				vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
			).join('.');
			break;
		case 2:
			addressLength = new Uint8Array(
				vlessBuffer.slice(addressValueIndex, addressValueIndex + 1)
			)[0];
			addressValueIndex += 1;
			addressValue = new TextDecoder().decode(
				vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
			);
			break;
		case 3:
			addressLength = 16;
			const dataView = new DataView(
				vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
			);
			// 2001:0db8:85a3:0000:0000:8a2e:0370:7334
			const ipv6 = [];
			for (let i = 0; i < 8; i++) {
				ipv6.push(dataView.getUint16(i * 2).toString(16));
			}
			addressValue = ipv6.join(':');
			// seems no need add [] for ipv6
			break;
		default:
			return {
				hasError: true,
				message: `invild  addressType is ${addressType}`,
			};
	}
	if (!addressValue) {
		return {
			hasError: true,
			message: `addressValue is empty, addressType is ${addressType}`,
		};
	}

	return {
		hasError: false,
		addressRemote: addressValue,
		addressType,
		portRemote,
		rawDataIndex: addressValueIndex + addressLength,
		vlessVersion: version,
		isUDP,
	};
}

/**
 * 
 * @param {import("@cloudflare/workers-types").Socket} remoteSocket 
 * @param {import("@cloudflare/workers-types").WebSocket} webSocket 
 * @param {Uint8Array} vlessResponseHeader 
 * @param {*} log 
 */
function remoteSocketToWS(remoteSocket, webSocket, vlessResponseHeader, isUDP, log) {
	// remote--> ws
	let remoteChunkCount = 0;
	let chunks = [];
	remoteSocket.readable
		.pipeTo(
			new WritableStream({
				start() {
					if (webSocket.readyState === WS_READY_STATE_OPEN) {
						webSocket.send(vlessResponseHeader);
					}
				},
				/**
				 * 
				 * @param {Uint8Array} chunk 
				 * @param {*} controller 
				 */
				async write(chunk, controller) {
					// remoteChunkCount++;
					if (webSocket.readyState === WS_READY_STATE_OPEN) {
						// seems no need rate limit this, CF seems fix this..
						// if (remoteChunkCount > 20000) {
						// 	// cf one package is 4096 byte(4kb),  4096 * 20000 = 80M
						// 	await delay(1);
						// }
						webSocket.send(chunk);
					} else {
						controller.error(
							'webSocket.readyState is not open, maybe close'
						);
					}
				},
				close() {
					log(`remoteConnection!.readable is close`);
					if(isUDP){
						safeCloseWebSocket(webSocket); 
					}
					// safeCloseWebSocket(webSocket); // no need server close websocket frist for some case will casue HTTP ERR_CONTENT_LENGTH_MISMATCH issue, client will send close event anyway.
				},
				abort(reason) {
					console.error(`remoteConnection!.readable abort`, reason);
				},
			})
		)
		.catch((error) => {
			console.error(
				`remoteSocketToWS has exception `,
				error.stack || error
			);
			safeCloseWebSocket(webSocket);
		});
}

/**
 * 
 * @param {string} base64Str 
 * @returns 
 */
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
	} catch (error) {
		return { error };
	}
}

/**
 * 
 * @param {import("@cloudflare/workers-types").Request} request 
 * @returns 
 */
function getClientIp(request) {
	const isNotCN = request.headers.get('cf-ipcountry')?.toUpperCase() !== 'CN';
	const clientIP = isNotCN ? request.headers.get('cf-connecting-ip') || '' : '';
	return clientIP;
}

/**
 * 	// 1--> ipv4  addressLength =4
 *	// 2--> domain name addressLength=addressBuffer[1]
 *	// 3--> ipv6  addressLength =16
 * @param {number | undefined} addressType 
 * @param {string | undefined} addressRemote 
 */
async function isCloudFlareIP(addressType, addressRemote) {
	if (!addressType || !addressRemote) {
		return false;
	}

	// not deal with ipv6 & ipv4
	if (addressType === 3 || addressType === 1) {
		return false;
	}
	// only case about domian case
	if (addressType === 2) {
		return await isBehindCFv6(addressRemote);
	}
	return false;
}


/**
 * 
 * @param {string} domain 
 * @returns {Promise<boolean>}
 */
async function isBehindCFv6(domain) {
	const doh = "https://1.1.1.1/dns-query";
	try {
		const response = await fetch(`${doh}?name=${domain}.cdn.cloudflare.net&type=AAAA`, {
			method: "GET",
			headers: {
				"Accept": "application/dns-json"
			}
		});
		//https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/
		const data = await response.json();
		const ans = data?.Answer;
		// here is the magic we think, we are not 100% sure this will cover all cases, but we think this is fine.. In the end, CF will fix the bug shortly..
		// 1. if domain have multiple AAAA for ${domain}.cdn.cloudflare.net, we think it use CF
		// 2. if case 1 not match, we use a byoList to check if domain contains any keywords from byoList
		return ans?.filter((record) => record.name === `${domain}.cdn.cloudflare.net` && record.type === 28).length > 1 || domainByoListCheck(domain, byoList);
	} catch (err) {
		console.error('isBehindCFv6 query error:', err);
		return false;
	}
};

/**
 * checks if a domain contains any keywords from a byoList
 * @param {string} domain 
 * @param {string[]} byoList 
 * @returns {boolean}
 */
function domainByoListCheck(domain, byoList) {
	for (let keyword of byoList) {
		if (domain.includes(keyword)) {
			return true;
		}
	}
	return false;
}



/**
 * This is not real UUID validation
 * @param {string} uuid 
 */
function isValidUUID(uuid) {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(uuid);
}

/**
 * 
 * @param {number} ms 
 * @returns 
 */
function delay(ms) {
	return new Promise((resolve, rej) => {
		setTimeout(resolve, ms);
	});
}


const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;
/**
 * Normally, WebSocket will not has exceptions when close.
 * @param {import("@cloudflare/workers-types").WebSocket} socket
 */
function safeCloseWebSocket(socket) {
	try {
		if (socket.readyState === WS_READY_STATE_OPEN || socket.readyState === WS_READY_STATE_CLOSING) {
			socket.close();
		}
	} catch (error) {
		console.error('safeCloseWebSocket error', error);
	}
}

const byteToHex = [];
for (let i = 0; i < 256; ++i) {
	byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
	return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
function stringify(arr, offset = 0) {
	const uuid = unsafeStringify(arr, offset);
	if (!isValidUUID(uuid)) {
		throw TypeError("Stringified UUID is invalid");
	}
	return uuid;
}
