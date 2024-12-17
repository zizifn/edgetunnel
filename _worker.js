// @ts-ignore
import { connect } from 'cloudflare:sockets';

// How to generate your own UUID:
// [Windows] Press "Win + R", input cmd and run:  Powershell -NoExit -Command "[guid]::NewGuid()"
let userID = 'd342d11e-d424-4583-b36e-524ab1f0afa4';

const พร็อกซีไอพีs = ['178.128.91.137'];

// if you want to use ipv6 or single พร็อกซีไอพี, please add comment at this line and remove comment at the next line
let พร็อกซีไอพี = พร็อกซีไอพีs[Math.floor(Math.random() * พร็อกซีไอพีs.length)];
// use single พร็อกซีไอพี instead of random
// let พร็อกซีไอพี = 'cdn.xn--b6gac.eu.org';
// ipv6 พร็อกซีไอพี example remove comment to use
// let พร็อกซีไอพี = "[2a01:4f8:c2c:123f:64:5:6810:c55a]"

let dohURL = 'https://sky.rethinkdns.com/1:-Pf_____9_8A_AMAIgE8kMABVDDmKOHTAKg='; // https://cloudflare-dns.com/dns-query or https://dns.google/dns-query

if (!isValidUUID(userID)) {
	throw new Error('uuid is invalid');
}

export default {
	/**
	 * @param {import("@cloudflare/workers-types").Request} request
	 * @param {{UUID: string, พร็อกซีไอพี: string, DNS_RESOLVER_URL: string, NODE_ID: int, API_HOST: string, API_TOKEN: string}} env
	 * @param {import("@cloudflare/workers-types").ExecutionContext} ctx
	 * @returns {Promise<Response>}
	 */
	async fetch(request, env, ctx) {
		// uuid_validator(request);
		try {
			userID = env.UUID || userID;
			พร็อกซีไอพี = env.PROXYIP || พร็อกซีไอพี;
			dohURL = env.DNS_RESOLVER_URL || dohURL;
			let userID_Path = userID;
			if (userID.includes(',')) {
				userID_Path = userID.split(',')[0];
			}
			const upgradeHeader = request.headers.get('Upgrade');
			if (!upgradeHeader || upgradeHeader !== 'websocket') {
				const url = new URL(request.url);
				switch (url.pathname) {
					case `/cf`: {
						return new Response(JSON.stringify(request.cf, null, 4), {
							status: 200,
							headers: {
								"Content-Type": "application/json;charset=utf-8",
							},
						});
					}
					case `/${userID_Path}`: {
						const วเลสConfig = getวเลสConfig(userID, request.headers.get('Host'));
						return new Response(`${วเลสConfig}`, {
							status: 200,
							headers: {
								"Content-Type": "text/html; charset=utf-8",
							}
						});
					};
					case `/sub/${userID_Path}`: {
						const url = new URL(request.url);
						const searchParams = url.searchParams;
						const วเลสSubConfig = สร้างวเลสSub(userID, request.headers.get('Host'));
						// Construct and return response object
						return new Response(btoa(วเลสSubConfig), {
							status: 200,
							headers: {
								"Content-Type": "text/plain;charset=utf-8",
							}
						});
					};
					case `/bestip/${userID_Path}`: {
						const headers = request.headers;
						const url = `https://sub.xf.free.hr/auto?host=${request.headers.get('Host')}&uuid=${userID}&path=/`;
						const bestSubConfig = await fetch(url, { headers: headers });
						return bestSubConfig;
					};
					default:
						// return new Response('Not found', { status: 404 });
						// For any other path, reverse proxy to 'ramdom website' and return the original response, caching it in the process
						const randomHostname = cn_hostnames[Math.floor(Math.random() * cn_hostnames.length)];
						const newHeaders = new Headers(request.headers);
						newHeaders.set('cf-connecting-ip', '1.2.3.4');
						newHeaders.set('x-forwarded-for', '1.2.3.4');
						newHeaders.set('x-real-ip', '1.2.3.4');
						newHeaders.set('referer', 'https://www.google.com/search?q=edtunnel');
						// Use fetch to proxy the request to 15 different domains
						const proxyUrl = 'https://' + randomHostname + url.pathname + url.search;
						let modifiedRequest = new Request(proxyUrl, {
							method: request.method,
							headers: newHeaders,
							body: request.body,
							redirect: 'manual',
						});
						const proxyResponse = await fetch(modifiedRequest, { redirect: 'manual' });
						// Check for 302 or 301 redirect status and return an error response
						if ([301, 302].includes(proxyResponse.status)) {
							return new Response(`Redirects to ${randomHostname} are not allowed.`, {
								status: 403,
								statusText: 'Forbidden',
							});
						}
						// Return the response from the proxy server
						return proxyResponse;
				}
			} else {
				return await วเลสOverWSHandler(request);
			}
		} catch (err) {
			/** @type {Error} */ let e = err;
			return new Response(e.toString());
		}
	},
};

export async function uuid_validator(request) {
	const hostname = request.headers.get('Host');
	const currentDate = new Date();

	const subdomain = hostname.split('.')[0];
	const year = currentDate.getFullYear();
	const month = String(currentDate.getMonth() + 1).padStart(2, '0');
	const day = String(currentDate.getDate()).padStart(2, '0');

	const formattedDate = `${year}-${month}-${day}`;

	// const daliy_sub = formattedDate + subdomain
	const hashHex = await hashHex_f(subdomain);
	// subdomain string contains timestamps utc and uuid string TODO.
	console.log(hashHex, subdomain, formattedDate);
}

export async function hashHex_f(string) {
	const encoder = new TextEncoder();
	const data = encoder.encode(string);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
	return hashHex;
}

/**
 * Handles วเลส over WebSocket requests by creating a WebSocket pair, accepting the WebSocket connection, and processing the วเลส header.
 * @param {import("@cloudflare/workers-types").Request} request The incoming request object.
 * @returns {Promise<Response>} A Promise that resolves to a WebSocket response object.
 */
async function วเลสOverWSHandler(request) {
	const webSocketPair = new WebSocketPair();
	const [client, webSocket] = Object.values(webSocketPair);
	webSocket.accept();

	let address = '';
	let portWithRandomLog = '';
	let currentDate = new Date();
	const log = (/** @type {string} */ info, /** @type {string | undefined} */ event) => {
		console.log(`[${currentDate} ${address}:${portWithRandomLog}] ${info}`, event || '');
	};
	const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';

	const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyDataHeader, log);

	/** @type {{ value: import("@cloudflare/workers-types").Socket | null}}*/
	let remoteSocketWapper = {
		value: null,
	};
	let udpStreamWrite = null;
	let isDns = false;

	// ws --> remote
	readableWebSocketStream.pipeTo(new WritableStream({
		async write(chunk, controller) {
			if (isDns && udpStreamWrite) {
				return udpStreamWrite(chunk);
			}
			if (remoteSocketWapper.value) {
				const writer = remoteSocketWapper.value.writable.getWriter()
				await writer.write(chunk);
				writer.releaseLock();
				return;
			}

			const {
				hasError,
				message,
				portRemote = 443,
				addressRemote = '',
				rawDataIndex,
				วเลสVersion = new Uint8Array([0, 0]),
				isUDP,
			} = processวเลสHeader(chunk, userID);
			address = addressRemote;
			portWithRandomLog = `${portRemote} ${isUDP ? 'udp' : 'tcp'} `;
			if (hasError) {
				// controller.error(message);
				throw new Error(message); // cf seems has bug, controller.error will not end stream
			}

			// If UDP and not DNS port, close it
			if (isUDP && portRemote !== 53) {
				throw new Error('UDP proxy only enabled for DNS which is port 53');
				// cf seems has bug, controller.error will not end stream
			}

			if (isUDP && portRemote === 53) {
				isDns = true;
			}

			// ["version", "附加信息长度 N"]
			const วเลสResponseHeader = new Uint8Array([วเลสVersion[0], 0]);
			const rawClientData = chunk.slice(rawDataIndex);

			// TODO: support udp here when cf runtime has udp support
			if (isDns) {
				const { write } = await handleUDPOutBound(webSocket, วเลสResponseHeader, log);
				udpStreamWrite = write;
				udpStreamWrite(rawClientData);
				return;
			}
			handleTCPOutBound(remoteSocketWapper, addressRemote, portRemote, rawClientData, webSocket, วเลสResponseHeader, log);
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
 * Handles outbound TCP connections.
 *
 * @param {any} remoteSocket 
 * @param {string} addressRemote The remote address to connect to.
 * @param {number} portRemote The remote port to connect to.
 * @param {Uint8Array} rawClientData The raw client data to write.
 * @param {import("@cloudflare/workers-types").WebSocket} webSocket The WebSocket to pass the remote socket to.
 * @param {Uint8Array} วเลสResponseHeader The วเลส response header.
 * @param {function} log The logging function.
 * @returns {Promise<void>} The remote socket.
 */
async function handleTCPOutBound(remoteSocket, addressRemote, portRemote, rawClientData, webSocket, วเลสResponseHeader, log,) {

	/**
	 * Connects to a given address and port and writes data to the socket.
	 * @param {string} address The address to connect to.
	 * @param {number} port The port to connect to.
	 * @returns {Promise<import("@cloudflare/workers-types").Socket>} A Promise that resolves to the connected socket.
	 */
	async function connectAndWrite(address, port) {
		/** @type {import("@cloudflare/workers-types").Socket} */
		const tcpSocket = connect({
			hostname: address,
			port: port,
		});
		remoteSocket.value = tcpSocket;
		log(`connected to ${address}:${port}`);
		const writer = tcpSocket.writable.getWriter();
		await writer.write(rawClientData); // first write, nomal is tls client hello
		writer.releaseLock();
		return tcpSocket;
	}

	/**
	 * Retries connecting to the remote address and port if the Cloudflare socket has no incoming data.
	 * @returns {Promise<void>} A Promise that resolves when the retry is complete.
	 */
	async function retry() {
		const tcpSocket = await connectAndWrite(พร็อกซีไอพี || addressRemote, portRemote)
		tcpSocket.closed.catch(error => {
			console.log('retry tcpSocket closed error', error);
		}).finally(() => {
			safeCloseWebSocket(webSocket);
		})
		remoteSocketToWS(tcpSocket, webSocket, วเลสResponseHeader, null, log);
	}

	const tcpSocket = await connectAndWrite(addressRemote, portRemote);

	// when remoteSocket is ready, pass to websocket
	// remote--> ws
	remoteSocketToWS(tcpSocket, webSocket, วเลสResponseHeader, retry, log);
}

/**
 * Creates a readable stream from a WebSocket server, allowing for data to be read from the WebSocket.
 * @param {import("@cloudflare/workers-types").WebSocket} webSocketServer The WebSocket server to create the readable stream from.
 * @param {string} earlyDataHeader The header containing early data for WebSocket 0-RTT.
 * @param {(info: string)=> void} log The logging function.
 * @returns {ReadableStream} A readable stream that can be used to read data from the WebSocket.
 */
function makeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
	let readableStreamCancel = false;
	const stream = new ReadableStream({
		start(controller) {
			webSocketServer.addEventListener('message', (event) => {
				const message = event.data;
				controller.enqueue(message);
			});

			webSocketServer.addEventListener('close', () => {
				safeCloseWebSocket(webSocketServer);
				controller.close();
			});

			webSocketServer.addEventListener('error', (err) => {
				log('webSocketServer has error');
				controller.error(err);
			});
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
			log(`ReadableStream was canceled, due to ${reason}`)
			readableStreamCancel = true;
			safeCloseWebSocket(webSocketServer);
		}
	});

	return stream;
}

// https://xtls.github.io/development/protocols/วเลส.html
// https://github.com/zizifn/excalidraw-backup/blob/main/v2ray-protocol.excalidraw

/**
 * Processes the วเลส header buffer and returns an object with the relevant information.
 * @param {ArrayBuffer} วเลสBuffer The วเลส header buffer to process.
 * @param {string} userID The user ID to validate against the UUID in the วเลส header.
 * @returns {{
 *  hasError: boolean,
 *  message?: string,
 *  addressRemote?: string,
 *  addressType?: number,
 *  portRemote?: number,
 *  rawDataIndex?: number,
 *  วเลสVersion?: Uint8Array,
 *  isUDP?: boolean
 * }} An object with the relevant information extracted from the วเลส header buffer.
 */
function processวเลสHeader(วเลสBuffer, userID) {
	if (วเลสBuffer.byteLength < 24) {
		return {
			hasError: true,
			message: 'invalid data',
		};
	}

	const version = new Uint8Array(วเลสBuffer.slice(0, 1));
	let isValidUser = false;
	let isUDP = false;
	const slicedBuffer = new Uint8Array(วเลสBuffer.slice(1, 17));
	const slicedBufferString = stringify(slicedBuffer);
	// check if userID is valid uuid or uuids split by , and contains userID in it otherwise return error message to console
	const uuids = userID.includes(',') ? userID.split(",") : [userID];
	// uuid_validator(hostName, slicedBufferString);


	// isValidUser = uuids.some(userUuid => slicedBufferString === userUuid.trim());
	isValidUser = uuids.some(userUuid => slicedBufferString === userUuid.trim()) || uuids.length === 1 && slicedBufferString === uuids[0].trim();

	console.log(`userID: ${slicedBufferString}`);

	if (!isValidUser) {
		return {
			hasError: true,
			message: 'invalid user',
		};
	}

	const optLength = new Uint8Array(วเลสBuffer.slice(17, 18))[0];
	//skip opt for now

	const command = new Uint8Array(
		วเลสBuffer.slice(18 + optLength, 18 + optLength + 1)
	)[0];

	// 0x01 TCP
	// 0x02 UDP
	// 0x03 MUX
	if (command === 1) {
		isUDP = false;
	} else if (command === 2) {
		isUDP = true;
	} else {
		return {
			hasError: true,
			message: `command ${command} is not support, command 01-tcp,02-udp,03-mux`,
		};
	}
	const portIndex = 18 + optLength + 1;
	const portBuffer = วเลสBuffer.slice(portIndex, portIndex + 2);
	// port is big-Endian in raw data etc 80 == 0x005d
	const portRemote = new DataView(portBuffer).getUint16(0);

	let addressIndex = portIndex + 2;
	const addressBuffer = new Uint8Array(
		วเลสBuffer.slice(addressIndex, addressIndex + 1)
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
				วเลสBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
			).join('.');
			break;
		case 2:
			addressLength = new Uint8Array(
				วเลสBuffer.slice(addressValueIndex, addressValueIndex + 1)
			)[0];
			addressValueIndex += 1;
			addressValue = new TextDecoder().decode(
				วเลสBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
			);
			break;
		case 3:
			addressLength = 16;
			const dataView = new DataView(
				วเลสBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
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
		วเลสVersion: version,
		isUDP,
	};
}


/**
 * Converts a remote socket to a WebSocket connection.
 * @param {import("@cloudflare/workers-types").Socket} remoteSocket The remote socket to convert.
 * @param {import("@cloudflare/workers-types").WebSocket} webSocket The WebSocket to connect to.
 * @param {ArrayBuffer | null} วเลสResponseHeader The วเลส response header.
 * @param {(() => Promise<void>) | null} retry The function to retry the connection if it fails.
 * @param {(info: string) => void} log The logging function.
 * @returns {Promise<void>} A Promise that resolves when the conversion is complete.
 */
async function remoteSocketToWS(remoteSocket, webSocket, วเลสResponseHeader, retry, log) {
	// remote--> ws
	let remoteChunkCount = 0;
	let chunks = [];
	/** @type {ArrayBuffer | null} */
	let วเลสHeader = วเลสResponseHeader;
	let hasIncomingData = false; // check if remoteSocket has incoming data
	await remoteSocket.readable
		.pipeTo(
			new WritableStream({
				start() {
				},
				/**
				 * 
				 * @param {Uint8Array} chunk 
				 * @param {*} controller 
				 */
				async write(chunk, controller) {
					hasIncomingData = true;
					remoteChunkCount++;
					if (webSocket.readyState !== WS_READY_STATE_OPEN) {
						controller.error(
							'webSocket.readyState is not open, maybe close'
						);
					}
					if (วเลสHeader) {
						webSocket.send(await new Blob([วเลสHeader, chunk]).arrayBuffer());
						วเลสHeader = null;
					} else {
						// console.log(`remoteSocketToWS send chunk ${chunk.byteLength}`);
						// seems no need rate limit this, CF seems fix this??..
						// if (remoteChunkCount > 20000) {
						// 	// cf one package is 4096 byte(4kb),  4096 * 20000 = 80M
						// 	await delay(1);
						// }
						webSocket.send(chunk);
					}
				},
				close() {
					log(`remoteConnection!.readable is close with hasIncomingData is ${hasIncomingData}`);
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

	// seems is cf connect socket have error,
	// 1. Socket.closed will have error
	// 2. Socket.readable will be close without any data coming
	if (hasIncomingData === false && retry) {
		log(`retry`)
		retry();
	}
}

/**
 * Decodes a base64 string into an ArrayBuffer.
 * @param {string} base64Str The base64 string to decode.
 * @returns {{earlyData: ArrayBuffer|null, error: Error|null}} An object containing the decoded ArrayBuffer or null if there was an error, and any error that occurred during decoding or null if there was no error.
 */
function base64ToArrayBuffer(base64Str) {
	if (!base64Str) {
		return { earlyData: null, error: null };
	}
	try {
		// go use modified Base64 for URL rfc4648 which js atob not support
		base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
		const decode = atob(base64Str);
		const arryBuffer = Uint8Array.from(decode, (c) => c.charCodeAt(0));
		return { earlyData: arryBuffer.buffer, error: null };
	} catch (error) {
		return { earlyData: null, error };
	}
}

/**
 * Checks if a given string is a valid UUID.
 * Note: This is not a real UUID validation.
 * @param {string} uuid The string to validate as a UUID.
 * @returns {boolean} True if the string is a valid UUID, false otherwise.
 */
function isValidUUID(uuid) {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(uuid);
}

const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;
/**
 * Closes a WebSocket connection safely without throwing exceptions.
 * @param {import("@cloudflare/workers-types").WebSocket} socket The WebSocket connection to close.
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


/**
 * Handles outbound UDP traffic by transforming the data into DNS queries and sending them over a WebSocket connection.
 * @param {import("@cloudflare/workers-types").WebSocket} webSocket The WebSocket connection to send the DNS queries over.
 * @param {ArrayBuffer} วเลสResponseHeader The วเลส response header.
 * @param {(string) => void} log The logging function.
 * @returns {{write: (chunk: Uint8Array) => void}} An object with a write method that accepts a Uint8Array chunk to write to the transform stream.
 */
async function handleUDPOutBound(webSocket, วเลสResponseHeader, log) {

	let isวเลสHeaderSent = false;
	const transformStream = new TransformStream({
		start(controller) {

		},
		transform(chunk, controller) {
			// udp message 2 byte is the the length of udp data
			// TODO: this should have bug, beacsue maybe udp chunk can be in two websocket message
			for (let index = 0; index < chunk.byteLength;) {
				const lengthBuffer = chunk.slice(index, index + 2);
				const udpPakcetLength = new DataView(lengthBuffer).getUint16(0);
				const udpData = new Uint8Array(
					chunk.slice(index + 2, index + 2 + udpPakcetLength)
				);
				index = index + 2 + udpPakcetLength;
				controller.enqueue(udpData);
			}
		},
		flush(controller) {
		}
	});

	// only handle dns udp for now
	transformStream.readable.pipeTo(new WritableStream({
		async write(chunk) {
			const resp = await fetch(dohURL, // dns server url
				{
					method: 'POST',
					headers: {
						'content-type': 'application/dns-message',
					},
					body: chunk,
				})
			const dnsQueryResult = await resp.arrayBuffer();
			const udpSize = dnsQueryResult.byteLength;
			// console.log([...new Uint8Array(dnsQueryResult)].map((x) => x.toString(16)));
			const udpSizeBuffer = new Uint8Array([(udpSize >> 8) & 0xff, udpSize & 0xff]);
			if (webSocket.readyState === WS_READY_STATE_OPEN) {
				log(`doh success and dns message length is ${udpSize}`);
				if (isวเลสHeaderSent) {
					webSocket.send(await new Blob([udpSizeBuffer, dnsQueryResult]).arrayBuffer());
				} else {
					webSocket.send(await new Blob([วเลสResponseHeader, udpSizeBuffer, dnsQueryResult]).arrayBuffer());
					isวเลสHeaderSent = true;
				}
			}
		}
	})).catch((error) => {
		log('dns udp has error' + error)
	});

	const writer = transformStream.writable.getWriter();

	return {
		/**
		 * 
		 * @param {Uint8Array} chunk 
		 */
		write(chunk) {
			writer.write(chunk);
		}
	};
}

const at = 'QA==';
const pt = 'dmxlc3M=';
const ed = 'RUR0dW5uZWw=';
/**
 *
 * @param {string} userID - single or comma separated userIDs
 * @param {string | null} hostName
 * @returns {string}
 */
function getวเลสConfig(userIDs, hostName) {
	const commonUrlPart = `:443?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;
	const hashSeparator = "################################################################";

	// Split the userIDs into an array
	const userIDArray = userIDs.split(",");

	// Prepare output string for each userID
	const output = userIDArray.map((userID) => {
		const วเลสMain = atob(pt) + '://' + userID + atob(at) + hostName + commonUrlPart;
		const วเลสSec = atob(pt) + '://' + userID + atob(at) + พร็อกซีไอพี + commonUrlPart;
		return `<h2>UUID: ${userID}</h2>${hashSeparator}\nv2ray default ip
---------------------------------------------------------------
${วเลสMain}
<button onclick='copyToClipboard("${วเลสMain}")'><i class="fa fa-clipboard"></i> Copy วเลสMain</button>
---------------------------------------------------------------
v2ray with bestip
---------------------------------------------------------------
${วเลสSec}
<button onclick='copyToClipboard("${วเลสSec}")'><i class="fa fa-clipboard"></i> Copy วเลสSec</button>
---------------------------------------------------------------`;
	}).join('\n');
	const sublink = `https://${hostName}/sub/${userIDArray[0]}?format=clash`
	const subbestip = `https://${hostName}/bestip/${userIDArray[0]}`;
	const clash_link = `https://api.v1.mk/sub?target=clash&url=${encodeURIComponent(sublink)}&insert=false&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
	// Prepare header string
	const header = `
<p align='center'><img src='https://cloudflare-ipfs.com/ipfs/bafybeigd6i5aavwpr6wvnwuyayklq3omonggta4x2q7kpmgafj357nkcky' alt='图片描述' style='margin-bottom: -50px;'>
<b style='font-size: 15px;'>Welcome! This function generates configuration for วเลส protocol. If you found this useful, please check our GitHub project for more:</b>
<b style='font-size: 15px;'>欢迎！这是生成 วเลส 协议的配置。如果您发现这个项目很好用，请查看我们的 GitHub 项目给我一个star：</b>
<a href='https://github.com/3Kmfi6HP/EDtunnel' target='_blank'>EDtunnel - https://github.com/3Kmfi6HP/EDtunnel</a>
<iframe src='https://ghbtns.com/github-btn.html?user=USERNAME&repo=REPOSITORY&type=star&count=true&size=large' frameborder='0' scrolling='0' width='170' height='30' title='GitHub'></iframe>
<a href='//${hostName}/sub/${userIDArray[0]}' target='_blank'>วเลส 节点订阅连接</a>
<a href='clash://install-config?url=${encodeURIComponent(`https://${hostName}/sub/${userIDArray[0]}?format=clash`)}}' target='_blank'>Clash for Windows 节点订阅连接</a>
<a href='${clash_link}' target='_blank'>Clash 节点订阅连接</a>
<a href='${subbestip}' target='_blank'>优选IP自动节点订阅</a>
<a href='clash://install-config?url=${encodeURIComponent(subbestip)}' target='_blank'>Clash优选IP自动</a>
<a href='sing-box://import-remote-profile?url=${encodeURIComponent(subbestip)}' target='_blank'>singbox优选IP自动</a>
<a href='sn://subscription?url=${encodeURIComponent(subbestip)}' target='_blank'>nekobox优选IP自动</a>
<a href='v2rayng://install-config?url=${encodeURIComponent(subbestip)}' target='_blank'>v2rayNG优选IP自动</a></p>`;

	// HTML Head with CSS and FontAwesome library
	const htmlHead = `
  <head>
	<title>EDtunnel: วเลส configuration</title>
	<meta name='description' content='This is a tool for generating วเลส protocol configurations. Give us a star on GitHub https://github.com/3Kmfi6HP/EDtunnel if you found it useful!'>
	<meta name='keywords' content='EDtunnel, cloudflare pages, cloudflare worker, severless'>
	<meta name='viewport' content='width=device-width, initial-scale=1'>
	<meta property='og:site_name' content='EDtunnel: วเลส configuration' />
	<meta property='og:type' content='website' />
	<meta property='og:title' content='EDtunnel - วเลส configuration and subscribe output' />
	<meta property='og:description' content='Use cloudflare pages and worker severless to implement วเลส protocol' />
	<meta property='og:url' content='https://${hostName}/' />
	<meta property='og:image' content='https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`วเลส://${userIDs.split(",")[0]}@${hostName}${commonUrlPart}`)}' />
	<meta name='twitter:card' content='summary_large_image' />
	<meta name='twitter:title' content='EDtunnel - วเลส configuration and subscribe output' />
	<meta name='twitter:description' content='Use cloudflare pages and worker severless to implement วเลส protocol' />
	<meta name='twitter:url' content='https://${hostName}/' />
	<meta name='twitter:image' content='https://cloudflare-ipfs.com/ipfs/bafybeigd6i5aavwpr6wvnwuyayklq3omonggta4x2q7kpmgafj357nkcky' />
	<meta property='og:image:width' content='1500' />
	<meta property='og:image:height' content='1500' />

	<style>
	body {
	  font-family: Arial, sans-serif;
	  background-color: #f0f0f0;
	  color: #333;
	  padding: 10px;
	}

	a {
	  color: #1a0dab;
	  text-decoration: none;
	}
	img {
	  max-width: 100%;
	  height: auto;
	}

	pre {
	  white-space: pre-wrap;
	  word-wrap: break-word;
	  background-color: #fff;
	  border: 1px solid #ddd;
	  padding: 15px;
	  margin: 10px 0;
	}
	/* Dark mode */
	@media (prefers-color-scheme: dark) {
	  body {
		background-color: #333;
		color: #f0f0f0;
	  }

	  a {
		color: #9db4ff;
	  }

	  pre {
		background-color: #282a36;
		border-color: #6272a4;
	  }
	}
	</style>

	<!-- Add FontAwesome library -->
	<link rel='stylesheet' href='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css'>
  </head>
  `;

	// Join output with newlines, wrap inside <html> and <body>
	return `
  <html>
  ${htmlHead}
  <body>
  <pre style='background-color: transparent; border: none;'>${header}</pre>
  <pre>${output}</pre>
  </body>
  <script>
	function copyToClipboard(text) {
	  navigator.clipboard.writeText(text)
		.then(() => {
		  alert("Copied to clipboard");
		})
		.catch((err) => {
		  console.error("Failed to copy to clipboard:", err);
		});
	}
  </script>
  </html>`;
}

const เซ็ตพอร์ตHttp = new Set([80, 8080, 8880, 2052, 2086, 2095, 2082]);
const เซ็ตพอร์ตHttps = new Set([443, 8443, 2053, 2096, 2087, 2083]);

function สร้างวเลสSub(ไอดีผู้ใช้_เส้นทาง, ชื่อโฮสต์) {
	const อาร์เรย์ไอดีผู้ใช้ = ไอดีผู้ใช้_เส้นทาง.includes(',') ? ไอดีผู้ใช้_เส้นทาง.split(',') : [ไอดีผู้ใช้_เส้นทาง];
	const ส่วนUrlทั่วไปHttp = `?encryption=none&security=none&fp=random&type=ws&host=${ชื่อโฮสต์}&path=%2F%3Fed%3D2048#`;
	const ส่วนUrlทั่วไปHttps = `?encryption=none&security=tls&sni=${ชื่อโฮสต์}&fp=random&type=ws&host=${ชื่อโฮสต์}&path=%2F%3Fed%3D2048#`;

	const ผลลัพธ์ = อาร์เรย์ไอดีผู้ใช้.flatMap((ไอดีผู้ใช้) => {
		const การกำหนดค่าHttp = Array.from(เซ็ตพอร์ตHttp).flatMap((พอร์ต) => {
			if (!ชื่อโฮสต์.includes('pages.dev')) {
				const ส่วนUrl = `${ชื่อโฮสต์}-HTTP-${พอร์ต}`;
				const วเลสหลักHttp = atob(pt) + '://' + ไอดีผู้ใช้ + atob(at) + ชื่อโฮสต์ + ':' + พอร์ต + ส่วนUrlทั่วไปHttp + ส่วนUrl;
				return พร็อกซีไอพีs.flatMap((พร็อกซีไอพี) => {
					const วเลสรองHttp = atob(pt) + '://' + ไอดีผู้ใช้ + atob(at) + พร็อกซีไอพี + ':' + พอร์ต + ส่วนUrlทั่วไปHttp + ส่วนUrl + '-' + พร็อกซีไอพี + '-' + atob(ed);
					return [วเลสหลักHttp, วเลสรองHttp];
				});
			}
			return [];
		});

		const การกำหนดค่าHttps = Array.from(เซ็ตพอร์ตHttps).flatMap((พอร์ต) => {
			const ส่วนUrl = `${ชื่อโฮสต์}-HTTPS-${พอร์ต}`;
			const วเลสหลักHttps = atob(pt) + '://' + ไอดีผู้ใช้ + atob(at) + ชื่อโฮสต์ + ':' + พอร์ต + ส่วนUrlทั่วไปHttps + ส่วนUrl;
			return พร็อกซีไอพีs.flatMap((พร็อกซีไอพี) => {
				const วเลสรองHttps = atob(pt) + '://' + ไอดีผู้ใช้ + atob(at) + พร็อกซีไอพี + ':' + พอร์ต + ส่วนUrlทั่วไปHttps + ส่วนUrl + '-' + พร็อกซีไอพี + '-' + atob(ed);
				return [วเลสหลักHttps, วเลสรองHttps];
			});
		});

		return [...การกำหนดค่าHttp, ...การกำหนดค่าHttps];
	});

	return ผลลัพธ์.join('\n');
}

const cn_hostnames = [
	'weibo.com',                // Weibo - A popular social media platform
	'www.baidu.com',            // Baidu - The largest search engine in China
	'www.qq.com',               // QQ - A widely used instant messaging platform
	'www.taobao.com',           // Taobao - An e-commerce website owned by Alibaba Group
	'www.jd.com',               // JD.com - One of the largest online retailers in China
	'www.sina.com.cn',          // Sina - A Chinese online media company
	'www.sohu.com',             // Sohu - A Chinese internet service provider
	'www.tmall.com',            // Tmall - An online retail platform owned by Alibaba Group
	'www.163.com',              // NetEase Mail - One of the major email providers in China
	'www.zhihu.com',            // Zhihu - A popular question-and-answer website
	'www.youku.com',            // Youku - A Chinese video sharing platform
	'www.xinhuanet.com',        // Xinhua News Agency - Official news agency of China
	'www.douban.com',           // Douban - A Chinese social networking service
	'www.meituan.com',          // Meituan - A Chinese group buying website for local services
	'www.toutiao.com',          // Toutiao - A news and information content platform
	'www.ifeng.com',            // iFeng - A popular news website in China
	'www.autohome.com.cn',      // Autohome - A leading Chinese automobile online platform
	'www.360.cn',               // 360 - A Chinese internet security company
	'www.douyin.com',           // Douyin - A Chinese short video platform
	'www.kuaidi100.com',        // Kuaidi100 - A Chinese express delivery tracking service
	'www.wechat.com',           // WeChat - A popular messaging and social media app
	'www.csdn.net',             // CSDN - A Chinese technology community website
	'www.imgo.tv',              // ImgoTV - A Chinese live streaming platform
	'www.aliyun.com',           // Alibaba Cloud - A Chinese cloud computing company
	'www.eyny.com',             // Eyny - A Chinese multimedia resource-sharing website
	'www.mgtv.com',             // MGTV - A Chinese online video platform
	'www.xunlei.com',           // Xunlei - A Chinese download manager and torrent client
	'www.hao123.com',           // Hao123 - A Chinese web directory service
	'www.bilibili.com',         // Bilibili - A Chinese video sharing and streaming platform
	'www.youth.cn',             // Youth.cn - A China Youth Daily news portal
	'www.hupu.com',             // Hupu - A Chinese sports community and forum
	'www.youzu.com',            // Youzu Interactive - A Chinese game developer and publisher
	'www.panda.tv',             // Panda TV - A Chinese live streaming platform
	'www.tudou.com',            // Tudou - A Chinese video-sharing website
	'www.zol.com.cn',           // ZOL - A Chinese electronics and gadgets website
	'www.toutiao.io',           // Toutiao - A news and information app
	'www.tiktok.com',           // TikTok - A Chinese short-form video app
	'www.netease.com',          // NetEase - A Chinese internet technology company
	'www.cnki.net',             // CNKI - China National Knowledge Infrastructure, an information aggregator
	'www.zhibo8.cc',            // Zhibo8 - A website providing live sports streams
	'www.zhangzishi.cc',        // Zhangzishi - Personal website of Zhang Zishi, a public intellectual in China
	'www.xueqiu.com',           // Xueqiu - A Chinese online social platform for investors and traders
	'www.qqgongyi.com',         // QQ Gongyi - Tencent's charitable foundation platform
	'www.ximalaya.com',         // Ximalaya - A Chinese online audio platform
	'www.dianping.com',         // Dianping - A Chinese online platform for finding and reviewing local businesses
	'www.suning.com',           // Suning - A leading Chinese online retailer
	'www.zhaopin.com',          // Zhaopin - A Chinese job recruitment platform
	'www.jianshu.com',          // Jianshu - A Chinese online writing platform
	'www.mafengwo.cn',          // Mafengwo - A Chinese travel information sharing platform
	'www.51cto.com',            // 51CTO - A Chinese IT technical community website
	'www.qidian.com',           // Qidian - A Chinese web novel platform
	'www.ctrip.com',            // Ctrip - A Chinese travel services provider
	'www.pconline.com.cn',      // PConline - A Chinese technology news and review website
	'www.cnzz.com',             // CNZZ - A Chinese web analytics service provider
	'www.telegraph.co.uk',      // The Telegraph - A British newspaper website	
	'www.ynet.com',             // Ynet - A Chinese news portal
	'www.ted.com',              // TED - A platform for ideas worth spreading
	'www.renren.com',           // Renren - A Chinese social networking service
	'www.pptv.com',             // PPTV - A Chinese online video streaming platform
	'www.liepin.com',           // Liepin - A Chinese online recruitment website
	'www.881903.com',           // 881903 - A Hong Kong radio station website
	'www.aipai.com',            // Aipai - A Chinese online video sharing platform
	'www.ttpaihang.com',        // Ttpaihang - A Chinese celebrity popularity ranking website
	'www.quyaoya.com',          // Quyaoya - A Chinese online ticketing platform
	'www.91.com',               // 91.com - A Chinese software download website
	'www.dianyou.cn',           // Dianyou - A Chinese game information website
	'www.tmtpost.com',          // TMTPost - A Chinese technology media platform
	'www.douban.com',           // Douban - A Chinese social networking service
	'www.guancha.cn',           // Guancha - A Chinese news and commentary website
	'www.so.com',               // So.com - A Chinese search engine
	'www.58.com',               // 58.com - A Chinese classified advertising website
	'www.cnblogs.com',          // Cnblogs - A Chinese technology blog community
	'www.cntv.cn',              // CCTV - China Central Television official website
	'www.secoo.com',            // Secoo - A Chinese luxury e-commerce platform
];
