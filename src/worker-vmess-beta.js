// <!--GAMFC-->version base on commit 2b9927a1b12e03f8ad4731541caee2bc5c8f2e8e, time is 2023-06-22 15:09:34 UTC<!--GAMFC-END-->.
// @ts-ignore

import { connect } from 'cloudflare:sockets';
// import { webcrypto as crypto } from "node:crypto"
import { Buffer } from 'node:buffer'
import AES from 'aes';
import CRC32 from "crc-32";
import jsSHA from "jssha";


// How to generate your own UUID:
// [Windows] Press "Win + R", input cmd and run:  Powershell -NoExit -Command "[guid]::NewGuid()"
let userID = '720bf125-9c89-4e5e-bc28-15dc910e1b66';

let proxyIP = '';

if (!isValidUUID(userID)) {
	throw new Error('uuid is not valid');
}

export const uuidCmdKeyMap = new Map();
const KDFSaltConstVMessAEADKDF = "VMess AEAD KDF";
const KDFSaltConstAuthIDEncryptionKey = "AES Auth ID Encryption";
const KDFSaltConstVMessHeaderPayloadLengthAEADKey = "VMess Header AEAD Key_Length"
const KDFSaltConstVMessHeaderPayloadLengthAEADIV = "VMess Header AEAD Nonce_Length"
const KDFSaltConstVMessHeaderPayloadAEADKey = "VMess Header AEAD Key"
const KDFSaltConstVMessHeaderPayloadAEADIV = "VMess Header AEAD Nonce"
const KDFSaltConstAEADRespHeaderLenKey = "AEAD Resp Header Len Key"
const KDFSaltConstAEADRespHeaderLenIV = "AEAD Resp Header Len IV"
const KDFSaltConstAEADRespHeaderPayloadKey = "AEAD Resp Header Key"
const KDFSaltConstAEADRespHeaderPayloadIV = "AEAD Resp Header IV"

export default {
	/**
	 * @param {import("@cloudflare/workers-types").Request} request
	 * @param {{UUID: string, PROXYIP: string}} env
	 * @param {import("@cloudflare/workers-types").ExecutionContext} ctx
	 * @returns {Promise<Response>}
	 */
	async fetch(request, env, ctx) {
		try {
			userID = env.UUID || userID;
			proxyIP = env.PROXYIP || proxyIP;
			if (!uuidCmdKeyMap.get(userID)) {
				const cmdKey = await convert2CMDKey(userID);
				uuidCmdKeyMap.set(userID, cmdKey);
				console.log(Buffer.from(cmdKey).toString('hex'));
			}
			const upgradeHeader = request.headers.get('Upgrade');
			if (!upgradeHeader || upgradeHeader !== 'websocket') {
				const url = new URL(request.url);
				switch (url.pathname) {
					case '/':
						return new Response(JSON.stringify(request.cf), { status: 200 });
					case `/${userID}`: {
						const vlessConfig = getVLESSConfig(userID, request.headers.get('Host'));
						return new Response(`${vlessConfig}`, {
							status: 200,
							headers: {
								"Content-Type": "text/plain;charset=utf-8",
							}
						});
					}
					default:
						return new Response('Not found', { status: 404 });
				}
			} else {
				return await vmessOverWSHandler(request);
			}
		} catch (err) {
			/** @type {Error} */ let e = err;
			return new Response(e.toString());
		}
	},
};



/**
 * 
 * @param {string} userID 
 * @returns
 */
async function convert2CMDKey(userID) {
	const cmdKeySource = Buffer.concat([Buffer.from(userID.replaceAll("-", ""), 'hex'), Buffer.from('c48619fe-8f02-49e0-b9e9-edf763e17e21')]);
	const cmdKey = await crypto.subtle.digest(
		{
			name: 'MD5',
		},
		cmdKeySource
	);
	return Buffer.from(cmdKey);
}

/**
 * 
 * @param {import("@cloudflare/workers-types").Request} request
 */
async function vmessOverWSHandler(request) {

	/** @type {import("@cloudflare/workers-types").WebSocket[]} */
	// @ts-ignore
	const webSocketPair = new WebSocketPair();
	const [client, webSocket] = Object.values(webSocketPair);

	webSocket.accept();

	let address = '';
	let portWithRandomLog = '';
	const log = (/** @type {string} */ info, /** @type {string | undefined} */ event) => {
		console.log(`[${address}:${portWithRandomLog}] ${info}`, event || '');
	};
	const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';

	const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyDataHeader, log);

	/** @type {{ value: import("@cloudflare/workers-types").Socket | null}}*/
	let remoteSocketWapper = {
		value: null,
	};
	let udpStreamWrite = null;
	let isDns = false;
	let reqMaskFun = null;
	const maskFun = null;
	// ws --> remote
	readableWebSocketStream.pipeTo(new WritableStream({
		async write(chunk, controller) {
			if (isDns && udpStreamWrite) {
				return udpStreamWrite(chunk);
			}
			if (remoteSocketWapper.value) {
				const writer = remoteSocketWapper.value.writable.getWriter()
				const chunkBuffer = Buffer.from(chunk);
				const dataLength = chunkBuffer.subarray(0, 2).readUInt16BE(0);
				const realSize = reqMaskFun() ^ dataLength;
				if (chunkBuffer.length - 2 !== realSize) {
					throw new Error('request body package size is large than chunk size, need split it');
				}
				const rawClientData = chunkBuffer.subarray(2, realSize + 2);
				await writer.write(rawClientData);
				writer.releaseLock();
				return;
			}

			/** @type{ { requestBody: Buffer}} */
			const {
				hasError,
				message,
				portRemote = 443,
				addressRemote = '',
				rawVMESSEncryptedDataIndex,
				requestBody,
				requestMaskFun,
				respMaskFun,
				isUDP,
				vmessResponseHeader
			} = await decodeVMESSRequestHeader(chunk, userID);
			address = addressRemote;
			reqMaskFun = requestMaskFun;
			portWithRandomLog = `${portRemote}--${Math.random()} ${isUDP ? 'udp ' : 'tcp '
				} `;
			if (hasError) {
				// controller.error(message);
				throw new Error(message); // cf seems has bug, controller.error will not end stream
				// webSocket.close(1000, message);
				return;
			}
			// if UDP but port not DNS port, close it
			if (isUDP) {
				if (portRemote === 53) {
					isDns = true;
				} else {
					// controller.error('UDP proxy only enable for DNS which is port 53');
					throw new Error('UDP proxy only enable for DNS which is port 53'); // cf seems has bug, controller.error will not end stream
					return;
				}
			}

			const dateLength = requestBody.subarray(0, 2).readUInt16BE(0);
			const realSize = reqMaskFun() ^ dateLength;
			if (requestBody.length - 2 !== realSize) {
				throw new Error('request body package size is large than chunk size, need split it');
			}
			const rawClientData = requestBody.subarray(2, realSize + 2);
			// TODO: support udp here when cf runtime has udp support
			if (isDns) {
				const { write } = await handleUDPOutBound(webSocket, vmessResponseHeader, log);
				udpStreamWrite = write;
				udpStreamWrite(rawClientData);
				return;
			}
			handleTCPOutBound(remoteSocketWapper, addressRemote, portRemote, rawClientData, webSocket, { vmessResponseHeader, respMaskFun }, log);
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
		// @ts-ignore
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
 * @param {{vmessResponseHeader: Buffer, respMaskFun: ()=> number}} vmessResponseHeader The VLESS response header.
 * @param {function} log The logging function.
 * @returns {Promise<void>} The remote socket.
 */
async function handleTCPOutBound(remoteSocket, addressRemote, portRemote, rawClientData, webSocket, vmessResponseHeader, log,) {
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

	// if the cf connect tcp socket have no incoming data, we retry to redirect ip
	async function retry() {
		const tcpSocket = await connectAndWrite(proxyIP || addressRemote, portRemote)
		// no matter retry success or not, close websocket
		tcpSocket.closed.catch(error => {
			console.log('retry tcpSocket closed error', error);
		}).finally(() => {
			safeCloseWebSocket(webSocket);
		})
		remoteSocketToWS(tcpSocket, webSocket, vmessResponseHeader, null, log);
	}

	const tcpSocket = await connectAndWrite(addressRemote, portRemote);

	// when remoteSocket is ready, pass to websocket
	// remote--> ws
	remoteSocketToWS(tcpSocket, webSocket, vmessResponseHeader, retry, log);
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
				// if stream is cancel, skip controller.close
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

// https://xtls.github.io/development/protocols/vless.html
// https://github.com/zizifn/excalidraw-backup/blob/main/v2ray-protocol.excalidraw

/**
 * 
 * @param { ArrayBuffer} vmessBuffer 
 * @param {string} userID 
 * @returns  
 */
export async function decodeVMESSRequestHeader(
	vmessBuffer,
	userID
) {
	const cmdkey = uuidCmdKeyMap.get(userID);
	if (!cmdkey) {
		return {
			hasError: true,
			message: 'invalid userID',
		};
	}
	if (vmessBuffer.byteLength < 24) {
		return {
			hasError: true,
			message: 'invalid data',
		};
	}


	const vmessNodeBuffer = Buffer.from(vmessBuffer);
	console.log(vmessNodeBuffer.toString("hex"));
	// 1. authid(16 byte)
	const authIDEncrypted = vmessNodeBuffer.subarray(0, 16);
	let authIDSaltList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstAuthIDEncryptionKey)]
	let authIDKey = await hmac_rec2(cmdkey, [...authIDSaltList])
	authIDKey = authIDKey.subarray(0, 16);
	const authIDAES = new AES(groupBufferBy4byte(authIDKey));
	const authIDDecrypted = authIDAES.decrypt(groupBufferBy4byte(authIDEncrypted));
	const authIDDecryptedHex = [];
	for (const uint32Value of authIDDecrypted) {
		const hexValue = uint32Value.toString(16).padStart(8, '0'); // Ensure each value is 8 characters long
		authIDDecryptedHex.push(hexValue);
	}
	const authIDDecryptedBuffer = Buffer.from(authIDDecryptedHex.join(''), "hex");
	const time = authIDDecryptedBuffer.readBigInt64BE(0);
	console.log(time);
	const rand = authIDDecryptedBuffer.readInt32BE(8);
	const crc32Zero = authIDDecryptedBuffer.readUInt32BE(12);

	const authIDChecksumSign = CRC32.buf(authIDDecryptedBuffer.subarray(0, 12));
	const authIDChecksumUnSign = authIDChecksumSign >>> 0;
	if (authIDChecksumUnSign !== crc32Zero) {
		return {
			hasError: true,
			message: 'auth id checksum error',
		};
	}
	const now = BigInt(Math.trunc(Date.now() / 1000));
	if (now - time < 120) {
		console.log("auth id time > 120s")
		// return {
		// 	hasError: true,
		// 	message: 'auth id time > 120s',
		// };
	}

	// 2. OpenVMessAEADHeader
	// 2.1 payloadHeaderLengthAEADEncrypted(18 bytes)
	// 2.2 nonce(8 bytes) 8f88be3d980ed2f8
	const payloadHeaderLengthAEADEncrypted = vmessNodeBuffer.subarray(16, 34)
	const nonceForOpenVMessAEADHeader = vmessNodeBuffer.subarray(34, 42)
	const payloadHeaderLengthSaltList =
		[Buffer.from(KDFSaltConstVMessAEADKDF),
		Buffer.from(KDFSaltConstVMessHeaderPayloadLengthAEADKey),
			authIDEncrypted, nonceForOpenVMessAEADHeader]
	const payloadHeaderLengthAEADKey = (await hmac_rec2(cmdkey, payloadHeaderLengthSaltList)).subarray(0, 16);
	const payloadHeaderNonceSaltList =
		[Buffer.from(KDFSaltConstVMessAEADKDF),
		Buffer.from(KDFSaltConstVMessHeaderPayloadLengthAEADIV),
			authIDEncrypted, nonceForOpenVMessAEADHeader]
	const payloadHeaderLengthAEADNonce = (await hmac_rec2(cmdkey, payloadHeaderNonceSaltList)).subarray(0, 12);
	const aesGCMPayloadHeaderLengthAlgorithm = { name: 'AES-GCM', iv: payloadHeaderLengthAEADNonce, additionalData: authIDEncrypted };
	const payloadHeaderLengthGCMKEY =
		await crypto.subtle.importKey('raw', payloadHeaderLengthAEADKey, 'AES-GCM', false, ['decrypt']);
	const decryptedAEADHeaderLengthPayload = await crypto.subtle.decrypt(aesGCMPayloadHeaderLengthAlgorithm, payloadHeaderLengthGCMKEY, payloadHeaderLengthAEADEncrypted);
	const headerLength = Buffer.from(decryptedAEADHeaderLengthPayload).readInt16BE();

	// 2.3 payloadHeaderAEADEncrypted
	const rawVMESSEncryptedDataIndex = 42 + headerLength + 16; // use length + 16
	const payloadHeaderAEADEncrypted = vmessNodeBuffer.subarray(42, rawVMESSEncryptedDataIndex);
	let payloadHeaderSaltList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstVMessHeaderPayloadAEADKey), authIDEncrypted, nonceForOpenVMessAEADHeader]
	const payloadHeaderAEADKey = (await hmac_rec2(cmdkey, payloadHeaderSaltList)).subarray(0, 16);
	payloadHeaderSaltList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstVMessHeaderPayloadAEADIV), authIDEncrypted, nonceForOpenVMessAEADHeader]
	const payloadHeaderAEADIV = (await hmac_rec2(cmdkey, payloadHeaderSaltList)).subarray(0, 12);
	const aesGCMPayloadHeaderAlgorithm = { name: 'AES-GCM', iv: payloadHeaderAEADIV, additionalData: authIDEncrypted };
	const payloadHeaderGCMKEY =
		await crypto.subtle.importKey('raw', payloadHeaderAEADKey, 'AES-GCM', false, ['decrypt']);

	const decryptedAEADHeader = await crypto.subtle.decrypt(aesGCMPayloadHeaderAlgorithm, payloadHeaderGCMKEY, payloadHeaderAEADEncrypted);
	console.log(decryptedAEADHeader);
	const decryptedAEADHeaderPayload = Buffer.from(decryptedAEADHeader);
	let vmessHeadercursor = 1;

	// https://xtls.github.io/development/protocols/vmess.html#%E5%AE%A2%E6%88%B7%E7%AB%AF%E8%AF%B7%E6%B1%82
	const version = new Uint8Array(decryptedAEADHeaderPayload.subarray(0, 1));
	const requestBodyIV = decryptedAEADHeaderPayload.subarray(1, 17);
	const requestBodyKey = decryptedAEADHeaderPayload.subarray(17, 33);
	const vmessResponseHeaderV = decryptedAEADHeaderPayload.subarray(33, 34);
	const option = decryptedAEADHeaderPayload.subarray(34, 35)
	const paddingLenAndSecurity = decryptedAEADHeaderPayload.subarray(35, 36);
	const paddingLen = paddingLenAndSecurity[0] >> 4; // 0x65 >> 4 = 0x6
	// for now ONLY support 5: "NONE",
	// 0: "UNKNOWN",
	// 1: "LEGACY",
	// 2: "AUTO",
	// 3: "AES128_GCM",
	// 4: "CHACHA20_POLY1305",
	// 5: "NONE",
	// 6: "ZERO",
	const security = paddingLenAndSecurity[0] & 0x0F; // // 0x65 & 0x0F = 0x6
	if (security !== 5) {
		return {
			hasError: true,
			message: `Only support security as NONE`,
		};
	}

	const resverd = decryptedAEADHeaderPayload.subarray(36, 37)[0];

	// VMESS header btye 37
	const command = decryptedAEADHeaderPayload.subarray(37, 38)[0];
	// 0x01 TCP
	// 0x02 UDP
	// 0x03 MUX
	let isUDP = false;
	if (command === 1) {
	} else if (command === 2) {
		isUDP = true;
	} else {
		return {
			hasError: true,
			message: `command ${command} is not support, command 01-tcp,02-udp,03-mux`,
		};
	}
	const portRemote = decryptedAEADHeaderPayload.subarray(38, 40).readUInt16BE();

	// 1--> ipv4  addressLength =4
	// 2--> domain name addressLength=addressBuffer[1]
	// 3--> ipv6  addressLength =16
	const addressType = decryptedAEADHeaderPayload.subarray(40, 41)[0]
	vmessHeadercursor = 41;
	let addressValue = '';
	switch (addressType) {
		case 1:
			addressValue = decryptedAEADHeaderPayload.subarray(vmessHeadercursor, vmessHeadercursor += 4).join('.');
			break;
		case 2:
			const addressLength = decryptedAEADHeaderPayload.subarray(vmessHeadercursor, vmessHeadercursor += 1).readUInt8();
			addressValue = decryptedAEADHeaderPayload.subarray(vmessHeadercursor, vmessHeadercursor += addressLength).toString("utf8");
			break;
		case 3:
			const addressValueBuffer = decryptedAEADHeaderPayload.subarray(vmessHeadercursor, vmessHeadercursor += 16);
			// 2001:0db8:85a3:0000:0000:8a2e:0370:7334
			addressValue = addressValueBuffer.toString('hex').match(/.{1,4}/g).join(':');
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

	// smowhow v2ray need validate network raw data buffer.BytesTo(-4), but again I'm too stupid, skip this
	const padding = decryptedAEADHeaderPayload.subarray(vmessHeadercursor, vmessHeadercursor += paddingLen);
	const checkSum = decryptedAEADHeaderPayload.subarray(vmessHeadercursor, vmessHeadercursor += 4);


	// key and iv for response header length
	const responseBodyKeyArrayBuffer = (await crypto.subtle.digest("SHA-256", requestBodyKey)).slice(0, 16);
	const responseBodyKey = Buffer.from(responseBodyKeyArrayBuffer);
	const responseBodyIVArrayBuffer = (await crypto.subtle.digest("SHA-256", requestBodyIV)).slice(0, 16);
	const responseBodyIV = Buffer.from(responseBodyIVArrayBuffer);


	let keyList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstAEADRespHeaderLenKey)]
	/** @type{Buffer} */
	let aeadResponseHeaderLengthEncryptionKey = await hmac_rec2(responseBodyKey, [...keyList])
	aeadResponseHeaderLengthEncryptionKey = aeadResponseHeaderLengthEncryptionKey.subarray(0, 16)
	// console.log(aeadResponseHeaderLengthEncryptionKey);
	keyList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstAEADRespHeaderLenIV)]

	let aeadResponseHeaderLengthEncryptionIV = await hmac_rec2(responseBodyIV, [...keyList])
	aeadResponseHeaderLengthEncryptionIV = aeadResponseHeaderLengthEncryptionIV.subarray(0, 12)
	// console.log(aeadResponseHeaderLengthEncryptionIV);

	// key and iv for response header
	keyList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstAEADRespHeaderPayloadKey)]
	/** @type{Buffer} */
	let aeadResponseHeaderPayloadEncryptionKey = await hmac_rec2(responseBodyKey, [...keyList])
	aeadResponseHeaderPayloadEncryptionKey = aeadResponseHeaderPayloadEncryptionKey.subarray(0, 16)
	// console.log(aeadResponseHeaderPayloadEncryptionKey);
	keyList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstAEADRespHeaderPayloadIV)]

	let aeadResponseHeaderPayloadEncryptionIV = await hmac_rec2(responseBodyIV, [...keyList])
	aeadResponseHeaderPayloadEncryptionIV = aeadResponseHeaderPayloadEncryptionIV.subarray(0, 12)
	// console.log(aeadResponseHeaderPayloadEncryptionIV);
	// https://xtls.github.io/development/protocols/vmess.html#%E6%9C%8D%E5%8A%A1%E5%99%A8%E5%BA%94%E7%AD%94
	// 响应认证 V	选项 Opt	指令 Cmd	指令长度 M
	// 				00			00			00 // we not support cmd in cf worker
	const rawRespHeader = Buffer.concat([vmessResponseHeaderV, Buffer.from("000000", "hex")])
	const lengthBuffer = new ArrayBuffer(2);
	new DataView(lengthBuffer).setInt16(0, rawRespHeader.length, false)

	const aesGCMRespPayloadHeaderLengthAlgorithm = { name: 'AES-GCM', iv: aeadResponseHeaderLengthEncryptionIV, additionalData: undefined };
	const respPayloadHeaderLengthGCMKEY =
		await crypto.subtle.importKey('raw', aeadResponseHeaderLengthEncryptionKey, 'AES-GCM', false, ["encrypt", "decrypt"]);
	const encryptedAEADHeaderLengthPayload = await crypto.subtle.encrypt(aesGCMRespPayloadHeaderLengthAlgorithm, respPayloadHeaderLengthGCMKEY, lengthBuffer);
	// console.log(decryptedAEADHeaderLengthPayload);

	const aaeadResponseHeaderPayloadAlgorithmAlgorithm = { name: 'AES-GCM', iv: aeadResponseHeaderPayloadEncryptionIV, additionalData: undefined };
	const aeadResponseHeaderPayloadAlgorithmGCMKEY =
		await crypto.subtle.importKey('raw', aeadResponseHeaderPayloadEncryptionKey, 'AES-GCM', false, ["encrypt", "decrypt"]);
	const encryptedAEADHeaderPayload = await crypto.subtle.encrypt(aaeadResponseHeaderPayloadAlgorithmAlgorithm, aeadResponseHeaderPayloadAlgorithmGCMKEY, rawRespHeader);
	// console.log(encryptedAEADHeaderPayload);

	const requestMaskFun = chunkSizeParser(requestBodyIV);
	const respMaskFun = chunkSizeParser(responseBodyIV);

	const result = {
		hasError: false,
		addressRemote: addressValue,
		addressType,
		portRemote,
		version,
		vmessResponseHeaderV,
		vmessResponseHeader: Buffer.concat([Buffer.from(encryptedAEADHeaderLengthPayload), Buffer.from(encryptedAEADHeaderPayload)]),
		isUDP,
		security,
		option,
		requestBodyKey,
		requestBodyIV,
		rawVMESSEncryptedDataIndex,
		requestBody: vmessNodeBuffer.subarray(rawVMESSEncryptedDataIndex),
		aeadResponseHeaderLengthEncryptionKey,
		aeadResponseHeaderLengthEncryptionIV,
		aeadResponseHeaderPayloadEncryptionKey,
		aeadResponseHeaderPayloadEncryptionIV,
		requestMaskFun,
		respMaskFun
	}
	// console.log(JSON.stringify(result));
	return result;
}


class ChunkSizeParser {
	constructor(nonce, data) {
		this.nonce = nonce;
		this.data = data;
		const shaObj = new jsSHA("SHAKE128", "ARRAYBUFFER");
		shaObj.update(nonce);
		const maskHEX = shaObj.getHash("HEX", { outputLen: 256 })
		console.log(maskHEX);
		const maskBuffer = Buffer.from(maskHEX, "hex");
		this.maskBuffer = maskBuffer;
	}
	encode() {

	}

	decode() {

	}
}
/**
 * get real size for request 
 * @param {*} nonce 
 * @returns 
 */
function chunkSizeParser(nonce) {
	const shaObj = new jsSHA("SHAKE128", "ARRAYBUFFER");
	shaObj.update(nonce);
	const maskHEX = shaObj.getHash("HEX", { outputLen: 10240 })
	// console.log("xxxxx-----", maskHEX);
	const maskBuffer = Buffer.from(maskHEX, "hex");
	let index = 0;
	function next() {
		const mask = maskBuffer.readUint16BE(index);
		index += 2;
		// console.log("xxxxx---index--", index);
		return mask;
	}

	return next;
}

/**
 * 
 * @param {Buffer} requestBody 
 * @param {Buffer} requestBodyIV 
 */
export async function decodeVMESSRequestBody(requestBody, requestBodyIV) {


}




/**
 * 
 * @param {Buffer} authIDKey 
 * @returns 
 */
function groupBufferBy4byte(authIDKey) {
	const result = [];
	for (let i = 0; i < authIDKey.length; i += 4) {
		result.push(authIDKey.readUInt32BE(i));
	}
	return result;
}

/**
 * 
 * @param {import("@cloudflare/workers-types").Socket} remoteSocket 
 * @param {import("@cloudflare/workers-types").WebSocket} webSocket 
 * @param {{vmessResponseHeader: Buffer, respMaskFun: ()=> number}} vlessResponseHeader The VLESS response header.
 * @param {(() => Promise<void>) | null} retry
 * @param {*} log 
 */
async function remoteSocketToWS(remoteSocket, webSocket, { vmessResponseHeader, respMaskFun }, retry, log) {
	// remote--> ws
	let remoteChunkCount = 0;
	let chunks = [];
	/** @type {ArrayBuffer | null} */
	let vmessHeader = vmessResponseHeader;
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
					// remoteChunkCount++;
					if (webSocket.readyState !== WS_READY_STATE_OPEN) {
						controller.error(
							'webSocket.readyState is not open, maybe close'
						);
					}
					if (vmessHeader) {
						const realSize = chunk.length;
						const mask = respMaskFun();
						const size = mask ^ realSize;
						const sizeBuffer = new ArrayBuffer(2);
						new DataView(sizeBuffer).setInt16(0, size, false);
						const respBuffer = Buffer.concat([vmessHeader, Buffer.from(sizeBuffer), chunk]);
						// console.log(respBuffer.toString("hex"));
						webSocket.send(respBuffer);
						vmessHeader = null;
					} else {
						// seems no need rate limit this, CF seems fix this??..
						// if (remoteChunkCount > 20000) {
						// 	// cf one package is 4096 byte(4kb),  4096 * 20000 = 80M
						// 	await delay(1);
						// }
						const realSize = chunk.length;
						const mask = respMaskFun();
						const size = mask ^ realSize;
						const sizeBuffer = new ArrayBuffer(2);
						new DataView(sizeBuffer).setInt16(0, size, false);
						const respBuffer = Buffer.concat([Buffer.from(sizeBuffer), chunk]);
						// console.log(respBuffer.toString("hex"));
						webSocket.send(respBuffer);
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
 * This is not real UUID validation
 * @param {string} uuid 
 */
function isValidUUID(uuid) {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(uuid);
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


/**
 * 
 * @param {import("@cloudflare/workers-types").WebSocket} webSocket 
 * @param {ArrayBuffer} vlessResponseHeader 
 * @param {(string)=> void} log 
 */
async function handleUDPOutBound(webSocket, vlessResponseHeader, log) {

	let isVlessHeaderSent = false;
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
			const resp = await fetch('https://serverless-dns.deno.dev',
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
				if (isVlessHeaderSent) {
					webSocket.send(await new Blob([udpSizeBuffer, dnsQueryResult]).arrayBuffer());
				} else {
					webSocket.send(await new Blob([vlessResponseHeader, udpSizeBuffer, dnsQueryResult]).arrayBuffer());
					isVlessHeaderSent = true;
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

/**
 * 
 * @param {string} userID 
 * @param {string | null} hostName
 * @returns {string}
 */
function getVLESSConfig(userID, hostName) {
	const vlessMain = `vless://${userID}@${hostName}:443?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`
	return `
################################################################
v2ray
---------------------------------------------------------------
${vlessMain}
---------------------------------------------------------------
################################################################
clash-meta
---------------------------------------------------------------
- type: vless
  name: ${hostName}
  server: ${hostName}
  port: 443
  uuid: ${userID}
  network: ws
  tls: true
  udp: false
  sni: ${hostName}
  client-fingerprint: chrome
  ws-opts:
    path: "/?ed=2048"
    headers:
      host: ${hostName}
---------------------------------------------------------------
################################################################
`;
}

//#region help method
async function hmac_rec2(data, keyList) {
	const digest = 'SHA-256', blockSizeOfDigest = 64
	var key = keyList.pop()
	if (keyList.length > 0) {
		let k = null;
		// adjust key (according to HMAC specification)
		if (key.length > blockSizeOfDigest) { k = Buffer.allocUnsafe(blockSizeOfDigest).fill('\x00'); (await hmac_rec2(key, [...keyList])).copy(k) }
		else if (key.length < blockSizeOfDigest) { k = Buffer.allocUnsafe(blockSizeOfDigest).fill('\x00'); key.copy(k) }
		else k = key
		// create 'key xor ipad' and 'key xor opad' (according to HMAC specification)  
		var ik = Buffer.allocUnsafe(blockSizeOfDigest), ok = Buffer.allocUnsafe(blockSizeOfDigest)
		k.copy(ik); k.copy(ok)
		for (var i = 0; i < ik.length; i++) { ik[i] = 0x36 ^ ik[i]; ok[i] = 0x5c ^ ok[i] }
		// calculate HMac(HMac)
		var innerHMac = await hmac_rec2(Buffer.concat([ik, data]), [...keyList])
		var hMac = await hmac_rec2(Buffer.concat([ok, innerHMac]), [...keyList])
	} else {
		// calculate regular HMac(Hash)
		var keyMaterial = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: digest }, false, ['sign']);
		var hMac = Buffer.from(await crypto.subtle.sign('HMAC', keyMaterial, data));

	}
	return hMac
}
//#endregion

