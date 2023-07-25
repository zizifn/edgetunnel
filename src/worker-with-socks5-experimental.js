// <!--GAMFC-->version base on commit 2b9927a1b12e03f8ad4731541caee2bc5c8f2e8e, time is 2023-06-22 15:09:37 UTC<!--GAMFC-END-->.

// How to generate your own UUID:
// [Windows] Press "Win + R", input cmd and run:  Powershell -NoExit -Command "[guid]::NewGuid()"
// [Linux] Run uuidgen in terminal
export let globalConfig = {
	userID: 'd342d11e-d424-4583-b36e-524ab1f0afa4',

	// Time to wait before an outbound Websocket connection is established, in ms.
	openWSOutboundTimeout: 10000,

	// Since Cloudflare Worker does not support UDP outbound, we may try DNS over TCP.
	// Set to an empty string to disable UDP to TCP forwarding for DNS queries.
	dnsTCPServer: "8.8.4.4",

	// The order controls where to send the traffic after the previous one fails
	outbounds: [
		{
			protocol: "freedom"	// Compulsory, outbound locally.
		}
	]
};

// If you use this file as an ES module, you should set all fields below.
export let platformAPI = {
	/** 
 	* A wrapper for the TCP API, should return a Cloudflare Worker compatible socket.
	* The result is wrapped in a Promise, as in some platforms, the socket creation is async.
	* See: https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/
 	* @type {(host: string, port: number) => Promise<
	*    {
	*      readable: ReadableStream, 
	*      writable: {getWriter: () => {write: (data) => void, releaseLock: () => void}},
	*      closed: {Promise<void>}
	*    }>
	*  }
 	*/
	connect: null,

	/** 
 	* A wrapper for the Websocket API.
 	* @type {(url: string) => WebSocket} returns a WebSocket, should be compatile with the standard WebSocket API.
 	*/
	newWebSocket: null,

	/** 
 	* A wrapper for the UDP API, should return a NodeJS compatible UDP socket.
	* The result is wrapped in a Promise, as in some platforms, the socket creation is async.
 	* @type {(isIPv6: boolean) => Promise<
	*    {
	*      send: (datagram: any, offset: number, length: number, port: number, address: string, sendDoneCallback: (err: Error | null, bytes: number) => void) => void, 
	*      close: () => void,
	*      onmessage: (handler: (msg: Buffer, rinfo: RemoteInfo) => void) => void,
	*      onerror: (handler: (err: Error) => void) => void,
	*    }>
	*  }
 	*/
	associate: null,
}

/**
 * Foreach globalConfig.outbounds, start with {index: 0, serverIndex: 0}
 * @param {{index: number, serverIndex: number}} curPos
 * @returns {{protocol: string, address: string, port: number, user: string, pass: string,
 *  portMap: {Number: number}}}
 */
function getOutbound(curPos) {
	if (curPos.index >= globalConfig.outbounds.length) {
		// End of the outbounds array
		return null;
	}

	const outbound = globalConfig.outbounds.at(curPos.index);
	let serverCount = 0;
	/** @type {[{}]} */
	let servers;
	/** @type {{address: string, port: number}} */
	let curServer;
	let retVal = { protocol: outbound.protocol };
	switch (outbound.protocol) {
		case 'freedom':
			break;

		case 'forward':
			retVal.address = outbound.address;
			retVal.portMap = outbound.portMap;
			break;

		case 'socks':
			servers = outbound.settings.vnext;
			serverCount = servers.length;
			curServer = servers.at(curPos.serverIndex);
			retVal.address = curServer.address;
			retVal.port = curServer.port;

			if (curServer.users && curServer.users.length > 0) {
				const firstUser = curServer.users.at(0);
				retVal.user = firstUser.user;
				retVal.pass = firstUser.pass;
			}
			break;

		case 'vless':
			servers = outbound.settings.vnext;
			serverCount = servers.length;
			curServer = servers.at(curPos.serverIndex);
			retVal.address = curServer.address;
			retVal.port = curServer.port;

			retVal.pass = curServer.users.at(0).id;
			retVal.streamSettings = outbound.streamSettings;
			break;

		default:
			throw new Error(`Unknown outbound protocol: ${outbound.protocol}`);
	}

	curPos.serverIndex++;
	if (curPos.serverIndex >= serverCount) {
		// End of the vnext array
		curPos.serverIndex = 0;
		curPos.index++;
	}

	return retVal;
}

function canOutboundUDPVia(protocolName) {
	switch(protocolName) {
		case 'freedom':
			return platformAPI.associate != null;
		case 'vless':
			return true;
	}
	return false;
}

/** 
 * Setup the config (uuid & outbounds) from environmental variables.
 * This is the simplest case and should be preferred where possible.
 * @param {{
 *  UUID: string, 
 *  PROXYIP: string,	// E.g. 114.51.4.0
 *  PORTMAP: string,	// E.g. {443:8443}
 *  VLESS: string,		// E.g. vless://uuid@domain.name:port?type=ws&security=tls
 *  SOCKS5: string		// E.g. user:pass@host:port or host:port
 * }} env
 */
export function setConfigFromEnv(env) {
	globalConfig.userID = env.UUID || globalConfig.userID;

	globalConfig.outbounds = [
		{
			protocol: "freedom"	// Compulsory, outbound locally.
		}
	];

	if (env.PROXYIP) {
		let forward = {
			protocol: "forward",
			address: env.PROXYIP
		};

		if (env.PORTMAP) {
			forward.portMap = JSON.parse(env.PORTMAP);
		} else {
			forward.portMap = {};
		}

		globalConfig['outbounds'].push(forward);
	}

	// Example: vless://uuid@domain.name:port?type=ws&security=tls
	if (env.VLESS) {
		try {
			const {
				uuid,
				remoteHost,
				remotePort,
				queryParams,
				descriptiveText
			} = parseVlessString(env.VLESS);

			let vless = {
				"address": remoteHost,
				"port": remotePort,
				"users": [
					{
						"id": uuid
					}
				]
			};

			let streamSettings = {
				"network": queryParams['type'],
				"security": queryParams['security'],
			}

			if (queryParams['type'] == 'ws') {
				streamSettings.wsSettings = {
					"headers": {
						"Host": remoteHost
					},
					"path": decodeURIComponent(queryParams['path'])
				};
			}

			if (queryParams['security'] == 'tls') {
				streamSettings.tlsSettings = {
					"serverName": remoteHost,
					"allowInsecure": false
				};
			}

			globalConfig['outbounds'].push({
				protocol: "vless",
				settings: {
					"vnext": [ vless ]
				},
				streamSettings: streamSettings
			});
		} catch (err) {
			/** @type {Error} */
			let e = err;
			console.log(e.toString());
		}
	}

	// The user name and password should not contain special characters
	// Example: user:pass@host:port or host:port
	if (env.SOCKS5) {
		try {
			const {
				username,
				password,
				hostname,
				port,
			} = socks5AddressParser(env.SOCKS5);

			let socks = {
				"address": hostname,
				"port": port
			}

			if (username) {
				socks.users = [	// We only support one user per socks server
					{
						"user": username,
						"pass": password
					}
				]
			}

			globalConfig['outbounds'].push({
				protocol: "socks",
				settings: {
					"vnext": [ socks ]
				}
			});
		} catch (err) {
	  		/** @type {Error} */
			let e = err;
			console.log(e.toString());
		}
	}
}

// Cloudflare Workers entry
export default {
	/**
	 * @param {import("@cloudflare/workers-types").Request} request
	 * @param {{UUID: string, PROXYIP: string}} env
	 * @param {import("@cloudflare/workers-types").ExecutionContext} ctx
	 * @returns {Promise<Response>}
	 */
	async fetch(request, env, ctx) {
		if (env.LOGPOST) {
			redirectConsoleLog(env.LOGPOST, crypto.randomUUID());
		}

		try {
			setConfigFromEnv(env);
			const upgradeHeader = request.headers.get('Upgrade');
			if (!upgradeHeader || upgradeHeader !== 'websocket') {
				const url = new URL(request.url);
				switch (url.pathname) {
					case '/':
						return new Response(JSON.stringify(request.cf), { status: 200 });
					case `/${globalConfig.userID}`: {
						const vlessConfig = getVLESSConfig(request.headers.get('Host'));
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
				/** @type {import("@cloudflare/workers-types").WebSocket[]} */
				// @ts-ignore
				const webSocketPair = new WebSocketPair();
				const [client, webSocket] = Object.values(webSocketPair);

				webSocket.accept();
				const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
				const statusCode = vlessOverWSHandler(webSocket, earlyDataHeader);

				return new Response(null, {
					status: statusCode,
					// @ts-ignore
					webSocket: client,
				});
			}
		} catch (err) {
			/** @type {Error} */ let e = err;
			return new Response(e.toString());
		}
	},
};

/**
 * @param {string} logServer URL of the log server
 * @param {string} instanceId a UUID representing each instance
 */
export function redirectConsoleLog(logServer, instanceId) {
	let logID = 0;
	const oldConsoleLog = console.log;
	console.log = async (data) => {
		oldConsoleLog(data);
		if (data == null) {
			return;
		}
	
		let msg;
		if (data instanceof Object) {
			msg = JSON.stringify(data);
		} else {
			msg = String(data);
		}
	
		try {
			await fetch(logServer, {
				method: 'POST',
				headers: { 'Content-Type': "text/plain;charset=UTF-8" },
				body: instanceId + ` ${logID++} ` + msg
			});
		} catch (err) {
			oldConsoleLog(err.message);
		}
	};
}

try {
	const module = await import('cloudflare:sockets');
	platformAPI.connect = async (address, port) => {
		return module.connect({hostname: address, port: port});
	};

	platformAPI.newWebSocket = (url) => new WebSocket(url);
} catch (error) {
	console.log('Not on Cloudflare Workers!');
}

/**
 * If you use this file as an ES module, you call this function whenever your Websocket server accepts a new connection.
 * 
 * @param {WebSocket} webSocket The established websocket connection to the client, must be an accepted
 * @param {string} earlyDataHeader for ws 0rtt, an optional field "sec-websocket-protocol" in the request header
 *                                  may contain some base64 encoded data.
 * @returns {number} status code
 */
export function vlessOverWSHandler(webSocket, earlyDataHeader) {
	let logPrefix = '';
	const log = (/** @type {string} */ info, /** @type {string | undefined} */ event) => {
		console.log(`[${logPrefix}] ${info}`, event || '');
	};

	// for ws 0rtt
	const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
	if (error !== null) {
		return 500;
	}

	const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyData, null, log);

	let vlessHeader = null;

	// This source stream only contains raw traffic from the client
	// The vless header is stripped and parsed first.
	const fromClientTraffic = readableWebSocketStream.pipeThrough(new TransformStream({
		start() {
		},
		transform(chunk, controller) {
			if (vlessHeader) {
				controller.enqueue(chunk);
			} else {
				vlessHeader = processVlessHeader(chunk, globalConfig.userID);
				if (vlessHeader.hasError) {
					controller.error(`Failed to process Vless header: ${vlessHeader.message}`);
					controller.terminate();
					return;
				}
				const randTag = Math.round(Math.random()*1000000).toString(16).padStart(5, '0');
				logPrefix = `${vlessHeader.addressRemote}:${vlessHeader.portRemote} ${randTag} ${vlessHeader.isUDP ? 'UDP' : 'TCP'}`;
				const firstPayloadLen = chunk.byteLength - vlessHeader.rawDataIndex;
				log(`First payload length = ${firstPayloadLen}`);
				if (firstPayloadLen > 0) {
					controller.enqueue(chunk.slice(vlessHeader.rawDataIndex));
				}
			}
		},
		flush(controller){
		}
	}));

	/** @type {WritableStream | null}*/
	let remoteTrafficSink = null;

	// ws --> remote
	fromClientTraffic.pipeTo(new WritableStream({
		async write(chunk, controller) {
			// log(`remoteTrafficSink: ${remoteTrafficSink == null ? 'null' : 'ready'}`);
			if (remoteTrafficSink) {
				// After we parse the header and send the first chunk to the remote destination
				// We assume that after the handshake, the stream only contains the original traffic.
				// log('Send traffic from vless client to remote host');
				const writer = remoteTrafficSink.getWriter();
				await writer.ready;
				await writer.write(chunk);
				writer.releaseLock();
				return;
			}

			// ["version", "length of additional info"]
			const vlessResponse = {
				header: new Uint8Array([vlessHeader.vlessVersion[0], 0]),
			}
	
			// Need to ensure the outbound proxy (if any) is ready before proceeding.
			remoteTrafficSink = await handleOutBound(vlessHeader, chunk, webSocket, vlessResponse, log);
			// log('Outbound established!');
		},
		close() {
			log(`readableWebSocketStream has been closed`);
		},
		abort(reason) {
			log(`readableWebSocketStream aborts`, JSON.stringify(reason));
		},
	})).catch((err) => {
		log('readableWebSocketStream pipeTo error', err);
	});

	return 101;
}

/**
 * Handles outbound connections.
 * @param {{isUDP: boolean, addressType: number, addressRemote: string, portRemote: number}} vlessRequest
 * @param {Uint8Array} rawClientData The raw client data to write.
 * @param {import("@cloudflare/workers-types").WebSocket} webSocket The WebSocket to pass the remote socket to.
 * @param {{header: Uint8Array}} vlessResponse Contains information to produce the vless reponse, such as the header.
 * @param {function} log The logging function.
 * @returns {Promise<WritableStream | null>} a non-null fulfill indicates the success connection to the destination or the remote proxy server
 */
async function handleOutBound(vlessRequest, rawClientData, webSocket, vlessResponse, log) {
	let curOutBoundPtr = {index: 0, serverIndex: 0};

	// Check if we should forward UDP DNS requests to a designated TCP DNS server.
	// The vless packing of UDP datagrams is identical to the one used in TCP DNS protocol,
	// so we can directly send raw vless traffic to the TCP DNS server.
	// TCP DNS requests will not be touched.
	// If fail to directly reach the TCP DNS server, UDP DNS request will be attempted on the other outbounds
	const forwardDNS = vlessRequest.isUDP && (vlessRequest.portRemote == 53) && (globalConfig.dnsTCPServer ? true : false);

	// True if we absolutely need UDP outbound, fail otherwise
	// False if we may use TCP to somehow resolve that UDP query
	const enforceUDP = vlessRequest.isUDP && !forwardDNS;

	/**
	 *  @param {WritableStream} writableStream 
	 *  @param {Uint8Array} firstChunk
	 */
	async function writeFirstChunk(writableStream, firstChunk) {
		const writer = writableStream.getWriter();
		await writer.write(firstChunk); // First write, normally is tls client hello
		writer.releaseLock();
	}

	async function direct() {
		if (enforceUDP) {
			// TODO: Check what will happen if addressType == VlessAddrType.DomainName and that domain only resolves to a IPv6
			const udpClient = await platformAPI.associate(vlessRequest.addressType == VlessAddrType.IPv6);
			const writableStream = makeWritableUDPStream(udpClient, vlessRequest.addressRemote, vlessRequest.portRemote, log);
			const readableStream = makeReadableUDPStream(udpClient, log);
			log(`Connected to UDP://${vlessRequest.addressRemote}:${vlessRequest.portRemote}`);
			await writeFirstChunk(writableStream, rawClientData);
			return {
				readableStream,
				writableStream
			};
		}

		let addressTCP = vlessRequest.addressRemote;
		if (forwardDNS) {
			addressTCP = globalConfig.dnsTCPServer;
			log(`Redirect DNS request sent to UDP://${vlessRequest.addressRemote}:${vlessRequest.portRemote}`);
		}

		const tcpSocket = await platformAPI.connect(addressTCP, vlessRequest.portRemote);
		tcpSocket.closed.catch(error => log('[freedom] tcpSocket closed with error: ', error.message));
		log(`Connecting to tcp://${addressTCP}:${vlessRequest.portRemote}`);
		await writeFirstChunk(tcpSocket.writable, rawClientData);
		return {
			readableStream: tcpSocket.readable, 
			writableStream: tcpSocket.writable
		};
	}

	async function forward(proxyServer, portMap) {
		let portDest = vlessRequest.portRemote;
		if (typeof portMap === "object" && portMap[vlessRequest.portRemote] !== undefined) {
			portDest = portMap[vlessRequest.portRemote];
		}

		const tcpSocket = await platformAPI.connect(proxyServer, portDest);
		tcpSocket.closed.catch(error => log('[forward] tcpSocket closed with error: ', error.message));
		log(`Forwarding tcp://${vlessRequest.addressRemote}:${vlessRequest.portRemote} to ${proxyServer}:${portDest}`);
		await writeFirstChunk(tcpSocket.writable, rawClientData);
		return {
			readableStream: tcpSocket.readable, 
			writableStream: tcpSocket.writable
		};
	}

	// TODO: known problem, if we send an unreachable request to a valid socks5 server, it will wait indefinitely
	// TODO: Add support for proxying UDP via socks5 on runtimes that support UDP outbound
	async function socks5(address, port, user, pass) {
		const tcpSocket = await platformAPI.connect(address, port);
		tcpSocket.closed.catch(error => log('[socks] tcpSocket closed with error: ', error.message));
		log(`Connecting to ${vlessRequest.isUDP ? 'UDP' : 'TCP'}://${vlessRequest.addressRemote}:${vlessRequest.portRemote} via socks5 ${address}:${port}`);
		try {
			await socks5Connect(tcpSocket, user, pass, vlessRequest.addressType, vlessRequest.addressRemote, vlessRequest.portRemote, log);
		} catch(err) {
			log(`Socks5 outbound failed with: ${err.message}`);
			return null;
		}
		await writeFirstChunk(tcpSocket.writable, rawClientData);
		return {
			readableStream: tcpSocket.readable, 
			writableStream: tcpSocket.writable
		};
	}

	/**
	 * Start streaming traffic to a remote vless server.
	 * The first message must contain the query header plus part of the payload!
	 * The vless server responds to it with a response header plus part of the response from the destination.
	 * After the first message exchange, in the case of TCP, the streams in both directions carry raw TCP streams.
	 * Fragmentation won't cause any problem after the first message exchange.
	 * In the case of UDP, a 16-bit big-endian length field is prepended to each UDP datagram and then send through the streams.
	 * The first message exchange still applies.
	 * 
	 * @param {string} address 
	 * @param {number} port 
	 * @param {string} uuid 
	 * @param {{network: string, security: string}} streamSettings 
	 */
	async function vless(address, port, uuid, streamSettings) {
		try {
			checkVlessConfig(address, streamSettings);
		} catch(err) {
			log(`Vless outbound failed with: ${err.message}`);
			return null;
		}

		let wsURL = streamSettings.security === 'tls' ? 'wss://' : 'ws://';
		wsURL = wsURL + address + ':' + port;
		if (streamSettings.wsSettings && streamSettings.wsSettings.path) {
			wsURL = wsURL + streamSettings.wsSettings.path;
		}
		log(`Connecting to ${vlessRequest.isUDP ? 'UDP' : 'TCP'}://${vlessRequest.addressRemote}:${vlessRequest.portRemote} via vless ${wsURL}`);

		const wsToVlessServer = platformAPI.newWebSocket(wsURL);
		const openPromise = new Promise((resolve, reject) => {
			wsToVlessServer.onopen = () => resolve();
			wsToVlessServer.onclose = (code, reason) => 
				reject(new Error(`Closed with code ${code}, reason: ${reason}`));
			wsToVlessServer.onerror = (error) => reject(error);
			setTimeout(() => {
				reject({message: `Open connection timeout`});
			}, globalConfig.openWSOutboundTimeout);
		});

		// Wait for the connection to open
		try {
			await openPromise;
		} catch (err) {
			log(`Cannot open Websocket connection: ${err.message}`);
			wsToVlessServer.close();
			return null;
		}

		const writableStream = new WritableStream({
			async write(chunk, controller) {
				wsToVlessServer.send(chunk);
			},
			close() {
				log(`Vless Websocket closed`);
			},
			abort(reason) {
				console.error(`Vless Websocket aborted`, reason);
			},
		});

		/** @type {(firstChunk : Uint8Array) => Uint8Array} */
		const headerStripper = (firstChunk) => {
			if (firstChunk.length < 2) {
				throw new Error('Too short vless response');
			}

			const responseVersion = firstChunk[0];
			const addtionalBytes = firstChunk[1];

			if (responseVersion > 0) {
				log('Warning: unexpected vless version: ${responseVersion}, only supports 0.');
			}

			if (addtionalBytes > 0) {
				log('Warning: ignored ${addtionalBytes} byte(s) of additional information in the response.');
			}

			return firstChunk.slice(2 + addtionalBytes);
		};

		const readableStream = makeReadableWebSocketStream(wsToVlessServer, null, headerStripper, log);
		const vlessReqHeader = makeVlessReqHeader(vlessRequest.isUDP ? VlessCmd.UDP : VlessCmd.TCP, vlessRequest.addressType, vlessRequest.addressRemote, vlessRequest.portRemote, uuid, rawClientData);
		// Send the first packet (header + rawClientData), then strip the response header with headerStripper
		await writeFirstChunk(writableStream, joinUint8Array(vlessReqHeader, rawClientData));
		return {
			readableStream, 
			writableStream
		};
	}
	
	/** @returns {Promise<{readableStream: ReadableStream, writableStream: WritableStream} | null>} */
	async function connectAndWrite() {
		const outbound = getOutbound(curOutBoundPtr);
		if (outbound == null) {
			log('Reached end of the outbound chain');
			return null;
		} else {
			log(`Trying outbound ${curOutBoundPtr.index}:${curOutBoundPtr.serverIndex}`);
		}

		if (enforceUDP && !canOutboundUDPVia(outbound.protocol)) {
			// This outbound method does not support UDP
			return null;
		}

		switch (outbound.protocol) {
			case 'freedom':
				return await direct();
			case 'forward':
				return await forward(outbound.address, outbound.portMap);
			case 'socks':
				return await socks5(outbound.address, outbound.port, outbound.user, outbound.pass);
			case 'vless':
				return await vless(outbound.address, outbound.port, outbound.pass, outbound.streamSettings);
		}

		return null;
	}

	// Try each outbound method until we find a working one.
	/** @type {{readableStream: ReadableStream, writableStream: WritableStream} | null} */
	let destRWPair = null;
	while (curOutBoundPtr.index < globalConfig.outbounds.length) {
		if (destRWPair == null) {
			destRWPair = await connectAndWrite();
		} 
		
		if (destRWPair != null) {
			const hasIncomingData = await remoteSocketToWS(destRWPair.readableStream, webSocket, vlessResponse, log);
			if (hasIncomingData) {
				return destRWPair.writableStream;
			}

			// This outbound connects but does not work
			destRWPair = null;
		}
	}

	log('No more available outbound chain, abort!');
	safeCloseWebSocket(webSocket);
	return null;
}

/**
 * Make a source out of a UDP socket, wrap each datagram with vless UDP packing.
 * Each receive datagram will be prepended with a 16-bit big-endian length field.
 * 
 * @param {*} udpClient
 * @param {(info: string)=> void} log
 * @returns {ReadableStream} Datagrams received will be wrapped and made available in this stream.
 */
function makeReadableUDPStream(udpClient, log) {
	return new ReadableStream({
		start(controller) {
			udpClient.onmessage((message, info) => {
				// log(`Received ${info.size} bytes from UDP://${info.address}:${info.port}`)
				// Prepend length to each UDP datagram
				const header = new Uint8Array([(info.size >> 8) & 0xff, info.size & 0xff]);
				const encodedChunk = joinUint8Array(header, message);
				controller.enqueue(encodedChunk);
			});
			udpClient.onerror((error) => {
				log('UDP Error: ', error);
				controller.error(error);
			});
		},
		cancel(reason) {
			log(`UDP ReadableStream closed:`, reason);
			safeCloseUDP(udpClient);
		},
	});
}

/**
 * Make a sink out of a UDP socket, the input stream assumes valid vless UDP packing.
 * Each datagram to be sent should be prepended with a 16-bit big-endian length field.
 * 
 * @param {*} udpClient 
 * @param {string} addressRemote 
 * @param {port} portRemote 
 * @param {(info: string)=> void} log
 * @returns {WritableStream} write to this stream will send datagrams via UDP.
 */
function makeWritableUDPStream(udpClient, addressRemote, portRemote, log) {
	/** @type {Uint8Array} */
	let leftoverData = new Uint8Array(0);

	return new WritableStream({
		/** @param {ArrayBuffer} chunk */
		write(chunk, controller) {
			let byteArray = new Uint8Array(chunk);
			if (leftoverData.byteLength > 0) {
				// If we have any leftover data from previous chunk, merge it first
				byteArray = new Uint8Array(leftoverData.byteLength + chunk.byteLength);
				byteArray.set(leftoverData, 0);
				byteArray.set(new Uint8Array(chunk), leftoverData.byteLength);
			}

			let i = 0;
			while (i < byteArray.length) {
				if (i+1 >= byteArray.length) {
					// The length field is not intact
					leftoverData = byteArray.slice(i);
					break;
				}

				// Big-endian
				const datagramLen = (byteArray[i] << 8) | byteArray[i+1];

				if (i+2+datagramLen > byteArray.length) {
					// This UDP datagram is not intact
					leftoverData = byteArray.slice(i);
					break;
				}

				udpClient.send(byteArray, i + 2, datagramLen, portRemote, addressRemote, (err, bytes) => {
					if (err != null) {
						console.log('UDP send error', err);
						controller.error(`Failed to send UDP packet !! ${err}`);
						safeCloseUDP(udpClient);
					}
				});

				i += datagramLen + 2;
			}
		},
		close() {
			log(`UDP WritableStream closed`);
		},
		abort(reason) {
			console.error(`UDP WritableStream aborted`, reason);
		},
	});
}

function safeCloseUDP(socket) {
	try {
		socket.close();
	} catch (error) {
		console.error('safeCloseUDP error', error);
	}
}

/**
 * Make a source out of a WebSocket connection.
 * A ReadableStream should be created before performing any kind of write operation.
 * 
 * @param {import("@cloudflare/workers-types").WebSocket} webSocketServer
 * @param {Uint8Array} earlyData Data received before the ReadableStream was created
 * @param {(firstChunk : Uint8Array) => Uint8Array} headStripper In some protocol like Vless, 
 *  a header is prepended to the first data chunk, it is necessary to strip that header.
 * @param {(info: string)=> void} log
 * @returns {ReadableStream} a source of Uint8Array chunks
 */
function makeReadableWebSocketStream(webSocketServer, earlyData, headStripper, log) {
	let readableStreamCancel = false;
	let headStripped = false;
	const stream = new ReadableStream({
		start(controller) {
			if (earlyData) {
				controller.enqueue(earlyData);
			}

			webSocketServer.addEventListener('message', (event) => {
				if (readableStreamCancel) {
					return;
				}

				// Make sure that we use Uint8Array through out the process.
				// On Nodejs, event.data can be a Buffer or an ArrayBuffer
				// On Cloudflare Workers, event.data tend to be an ArrayBuffer
				let message = new Uint8Array(event.data);
				if (!headStripped) {
					headStripped = true;

					if (headStripper != null) {
						try {
							message = headStripper(message);
						} catch (err) {
							readableStreamCancel = true;
							controller.error(err);
							return;
						}
					}
				}

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
				log('webSocketServer has error: ' + err.message);
				controller.error(err);
			}
			);
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
 * @param { Uint8Array } vlessBuffer 
 * @param {string} userID the expected userID
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
	const version = vlessBuffer.slice(0, 1);
	let isValidUser = false;
	let isUDP = false;
	if (stringify(vlessBuffer.slice(1, 17)) === userID) {
		isValidUser = true;
	}
	if (!isValidUser) {
		return {
			hasError: true,
			message: 'invalid user',
		};
	}

	//skip opt for now
	const optLength = vlessBuffer.slice(17, 18)[0];

	const command = vlessBuffer.slice(18 + optLength, 18 + optLength + 1)[0];

	if (command === VlessCmd.TCP) {
	} else if (command === VlessCmd.UDP) {
		isUDP = true;
	} else {
		return {
			hasError: true,
			message: `Invalid command type: ${command}, only accepts: ${JSON.stringify(VlessCmd)}`,
		};
	}
	const portIndex = 18 + optLength + 1;
	// port is big-Endian in raw data etc 80 == 0x0050
	const portRemote = (vlessBuffer[portIndex] << 8) | vlessBuffer[portIndex + 1];

	let addressIndex = portIndex + 2;
	const addressBuffer = vlessBuffer.slice(addressIndex, addressIndex + 1);

	const addressType = addressBuffer[0];
	let addressLength = 0;
	let addressValueIndex = addressIndex + 1;
	let addressValue = '';
	switch (addressType) {
		case VlessAddrType.IPv4:
			addressLength = 4;
			addressValue = vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength).join('.');
			break;
		case VlessAddrType.DomainName:
			addressLength = vlessBuffer.slice(addressValueIndex, addressValueIndex + 1)[0];
			addressValueIndex += 1;
			addressValue = new TextDecoder().decode(
				vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
			);
			break;
		case VlessAddrType.IPv6:
			addressLength = 16;
			const ipv6Bytes = vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength);
			// 2001:0db8:85a3:0000:0000:8a2e:0370:7334
			const ipv6 = [];
			for (let i = 0; i < 8; i++) {
				const uint16_val = ipv6Bytes[i*2] << 8 | ipv6Bytes[i*2+1];
				ipv6.push(uint16_val.toString(16));
			}
			addressValue = ipv6.join(':');
			// seems no need add [] for ipv6
			break;
		default:
			return {
				hasError: true,
				message: `Invalid address type: ${addressType}, only accepts: ${JSON.stringify(VlessAddrType)}`,
			};
	}
	if (!addressValue) {
		return {
			hasError: true,
			message: `Empty addressValue!`,
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
 * Stream data from the remote destination (any) to the client side (Websocket)
 * @param {ReadableStream} remoteSocketReader from the remote destination
 * @param {import("@cloudflare/workers-types").WebSocket} webSocket to the client side
 * @param {{header: Uint8Array}} vlessResponse Contains information to produce the vless reponse, such as the header.
 * @param {*} log 
 * @returns {Promise<boolean>} has hasIncomingData
 */
async function remoteSocketToWS(remoteSocketReader, webSocket, vlessResponse, log) {
	// This promise fulfills if:
	// 1. There is any incoming data
	// 2. The remoteSocketReader closes without any data
	const toRemotePromise = new Promise((resolve) => {
		let headerSent = false;
		let hasIncomingData = false;
	
		// Add the response header and monitor if there is any traffic coming from the remote host.
		remoteSocketReader.pipeThrough(new TransformStream({
			start() {
			},
			transform(chunk, controller) {
				// Resolve the promise immediately if we got any data from the remote host.
				hasIncomingData = true;
				resolve(true);

				if (!headerSent) {
					controller.enqueue(joinUint8Array(vlessResponse.header, chunk));
					headerSent = true;
				} else {
					controller.enqueue(chunk);
				}
			},
			flush(controller) {
				log(`Response transformer flushed, hasIncomingData = ${hasIncomingData}`);

				// The connection has been closed, resolve the promise anyway.
				resolve(hasIncomingData);
			}
		}))
		.pipeTo(new WritableStream({
			start() {
			},
			async write(chunk, controller) {
				// remoteChunkCount++;
				if (webSocket.readyState !== WS_READY_STATE_OPEN) {
					controller.error(
						'webSocket.readyState is not open, maybe close'
					);
				}

				// seems no need rate limit this, CF seems fix this??..
				// if (remoteChunkCount > 20000) {
				// 	// cf one package is 4096 byte(4kb),  4096 * 20000 = 80M
				// 	await delay(1);
				// }
				webSocket.send(chunk);
			},
			close() {
				// log(`remoteSocket.readable has been close`);
				// The server dont need to close the websocket first, as it will cause ERR_CONTENT_LENGTH_MISMATCH
				// The client will close the connection anyway.
				// safeCloseWebSocket(webSocket); 
			},
			// abort(reason) {
			// 	console.error(`remoteSocket.readable aborts`, reason);
			// },
		}))
		.catch((error) => {
			console.error(
				`remoteSocketToWS has exception, readyState = ${webSocket.readyState} :`,
				error.stack || error
			);
			safeCloseWebSocket(webSocket);
		});
	});

	return await toRemotePromise;
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
		const buffer = Uint8Array.from(decode, (c) => c.charCodeAt(0));
		return { earlyData: buffer, error: null };
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

/**
 * 
 * @param {Uint8Array} array1 
 * @param {Uint8Array} array2
 * @returns {Uint8Array} the merged Uint8Array
 */
export function joinUint8Array(array1, array2) {
	let result = new Uint8Array(array1.byteLength + array2.byteLength);
	result.set(array1);
	result.set(array2, array1.byteLength);
	return result;
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
 * @param {{readable: ReadableStream, writable: {getWriter: () => {write: (data) => void, releaseLock: () => void}}}} socket
 * @param {string} username
 * @param {string} password
 * @param {number} addressType
 * @param {string} addressRemote
 * @param {number} portRemote
 * @param {function} log The logging function.
 */
async function socks5Connect(socket, username, password, addressType, addressRemote, portRemote, log) {
	const writer = socket.writable.getWriter();

	// Request head format (Worker -> Socks Server):
	// +----+----------+----------+
	// |VER | NMETHODS | METHODS  |
	// +----+----------+----------+
	// | 1  |    1     | 1 to 255 |
	// +----+----------+----------+

	// https://en.wikipedia.org/wiki/SOCKS#SOCKS5
	// For METHODS:
	// 0x00 NO AUTHENTICATION REQUIRED
	// 0x02 USERNAME/PASSWORD https://datatracker.ietf.org/doc/html/rfc1929
	await writer.write(new Uint8Array([5, 2, 0, 2]));

	const reader = socket.readable.getReader();
	const encoder = new TextEncoder();
	let res = (await reader.read()).value;
	if (!res) {
		throw new Error(`No response from the server`);
	}

	// Response format (Socks Server -> Worker):
	// +----+--------+
	// |VER | METHOD |
	// +----+--------+
	// | 1  |   1    |
	// +----+--------+
	if (res[0] !== 0x05) {
		throw new Error(`Wrong server version: ${res[0]} expected: 5`);
	}
	if (res[1] === 0xff) {
		throw new Error("No accepted authentication methods");
	}

	// if return 0x0502
	if (res[1] === 0x02) {
		log("Socks5: Server asks for authentication");
		if (!username || !password) {
			throw new Error("Please provide username/password");
		}
		// +----+------+----------+------+----------+
		// |VER | ULEN |  UNAME   | PLEN |  PASSWD  |
		// +----+------+----------+------+----------+
		// | 1  |  1   | 1 to 255 |  1   | 1 to 255 |
		// +----+------+----------+------+----------+
		const authRequest = new Uint8Array([
			1,
			username.length,
			...encoder.encode(username),
			password.length,
			...encoder.encode(password)
		]);
		await writer.write(authRequest);
		res = (await reader.read()).value;
		// expected 0x0100
		if (res[0] !== 0x01 || res[1] !== 0x00) {
			throw new Error("Authentication failed");
		}
	}

	// Request data format (Worker -> Socks Server):
	// +----+-----+-------+------+----------+----------+
	// |VER | CMD |  RSV  | ATYP | DST.ADDR | DST.PORT |
	// +----+-----+-------+------+----------+----------+
	// | 1  |  1  | X'00' |  1   | Variable |    2     |
	// +----+-----+-------+------+----------+----------+
	// ATYP: address type of following address
	// 0x01: IPv4 address
	// 0x03: Domain name
	// 0x04: IPv6 address
	// DST.ADDR: desired destination address
	// DST.PORT: desired destination port in network octet order

	// addressType
	// 1--> ipv4  addressLength =4
	// 2--> domain name
	// 3--> ipv6  addressLength =16
	let DSTADDR;	// DSTADDR = ATYP + DST.ADDR
	switch (addressType) {
		case 1:
			DSTADDR = new Uint8Array(
				[1, ...addressRemote.split('.').map(Number)]
			);
			break;
		case 2:
			DSTADDR = new Uint8Array(
				[3, addressRemote.length, ...encoder.encode(addressRemote)]
			);
			break;
		case 3:
			DSTADDR = new Uint8Array(
				[4, ...addressRemote.split(':').flatMap(x => [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2), 16)])]
			);
			break;
		default:
			log(`invild  addressType is ${addressType}`);
			return;
	}
	const socksRequest = new Uint8Array([5, 1, 0, ...DSTADDR, portRemote >> 8, portRemote & 0xff]);
	await writer.write(socksRequest);
	log('Socks5: Sent request');

	res = (await reader.read()).value;
	// Response format (Socks Server -> Worker):
	//  +----+-----+-------+------+----------+----------+
	// |VER | REP |  RSV  | ATYP | BND.ADDR | BND.PORT |
	// +----+-----+-------+------+----------+----------+
	// | 1  |  1  | X'00' |  1   | Variable |    2     |
	// +----+-----+-------+------+----------+----------+
	if (res[1] === 0x00) {
		log("Socks5: Connection opened");
	} else {
		throw new Error("Connection failed");
	}
	writer.releaseLock();
	reader.releaseLock();
}


/**
 * 
 * @param {string} address
 */
function socks5AddressParser(address) {
	let [latter, former] = address.split("@").reverse();
	let username, password, hostname, port;
	if (former) {
		const formers = former.split(":");
		if (formers.length !== 2) {
			throw new Error('Invalid SOCKS address format');
		}
		[username, password] = formers;
	}
	const latters = latter.split(":");
	port = Number(latters.pop());
	if (isNaN(port)) {
		throw new Error('Invalid SOCKS address format');
	}
	hostname = latters.join(":");
	const regex = /^\[.*\]$/;
	if (hostname.includes(":") && !regex.test(hostname)) {
		throw new Error('Invalid SOCKS address format');
	}
	return {
		username,
		password,
		hostname,
		port,
	}
}

const VlessCmd = {
	TCP: 1,
	UDP: 2,
	MUX: 3,
};

const VlessAddrType = {
	IPv4: 1,		// 4-bytes
	DomainName: 2,	// The first byte indicates the length of the following domain name
	IPv6: 3,		// 16-bytes
};

/**
 * Generate a vless request header.
 * @param {number} command see VlessCmd
 * @param {number} destType see VlessAddrType
 * @param {string} destAddr 
 * @param {number} destPort 
 * @param {string} uuid 
 * @returns {Uint8Array}
 */
function makeVlessReqHeader(command, destType, destAddr, destPort, uuid) {
	/** @type {number} */
	let addressFieldLength;
	/** @type {Uint8Array | undefined} */
	let addressEncoded;
	switch (destType) {
		case VlessAddrType.IPv4:
			addressFieldLength = 4;
			break;
		case VlessAddrType.DomainName:
			addressEncoded = new TextEncoder().encode(destAddr);
			addressFieldLength = addressEncoded.length + 1;
			break;
		case VlessAddrType.IPv6:
			addressFieldLength = 16;
			break;
		default:
			throw new Error(`Unknown address type: ${destType}`);
	}

	const uuidString = uuid.replace(/-/g, '');
	const uuidOffset = 1;
	const vlessHeader = new Uint8Array(22 + addressFieldLength);
	
	// Protocol Version = 0
	vlessHeader[0] = 0x00;
  
	for (let i = 0; i < uuidString.length; i += 2) {
		vlessHeader[uuidOffset + i / 2] = parseInt(uuidString.substr(i, 2), 16);
	}

	// Additional Information Length M = 0
	vlessHeader[17] = 0x00;

	// Instruction
	vlessHeader[18] = command;

	// Port, 2-byte big-endian
	vlessHeader[19] = destPort >> 8;
	vlessHeader[20] = destPort & 0xFF ;

	// Address Type
	// 1--> ipv4  addressLength =4
	// 2--> domain name addressLength=addressBuffer[1]
	// 3--> ipv6  addressLength =16
	vlessHeader[21] = destType;

	// Address
	switch (destType) {
		case VlessAddrType.IPv4:
			const octetsIPv4 = destAddr.split('.');
			for (let i = 0; i < 4; i++) {
				vlessHeader[22 + i] = parseInt(octetsIPv4[i]);
			}
			break;
		case VlessAddrType.DomainName:
			vlessHeader[22] = addressEncoded.length;
			vlessHeader.set(addressEncoded, 23);
			break;
		case VlessAddrType.IPv6:
			const groupsIPv6 = ipv6.split(':');
			for (let i = 0; i < 8; i++) {
			  const hexGroup = parseInt(groupsIPv6[i], 16);
			  vlessHeader[i * 2 + 22] = hexGroup >> 8;
			  vlessHeader[i * 2 + 23] = hexGroup & 0xFF;
			}
			break;
		default:
			throw new Error(`Unknown address type: ${destType}`);
	}

	return vlessHeader;
}

function checkVlessConfig(address, streamSettings) {
	if (streamSettings.network !== 'ws') {
		throw new Error(`Unsupported outbound stream method: ${streamSettings.network}, has to be ws (Websocket)`);
	}

	if (streamSettings.security !== 'tls' && streamSettings.security !== 'none') {
		throw new Error(`Usupported security layer: ${streamSettings.network}, has to be none or tls.`);
	}

	if (streamSettings.wsSettings && streamSettings.wsSettings.headers && streamSettings.wsSettings.headers.Host !== address) {
		throw new Error(`The Host field in the http header is different from the server address, this is unsupported due to Cloudflare API restrictions`);
	}

	if (streamSettings.tlsSettings && streamSettings.tlsSettings.serverName !== address) {
		throw new Error(`The SNI is different from the server address, this is unsupported due to Cloudflare API restrictions`);
	}
}

function parseVlessString(url) {
	const regex = /^(.+):\/\/(.+?)@(.+?):(\d+)(\?[^#]*)?(#.*)?$/;
	const match = url.match(regex);
  
	if (!match) {
	  throw new Error('Invalid URL format');
	}
  
	const [, protocol, uuid, remoteHost, remotePort, query, descriptiveText] = match;
  
	const json = {
		protocol,
	 	uuid,
		remoteHost,
		remotePort: parseInt(remotePort),
		descriptiveText: descriptiveText ? descriptiveText.substring(1) : '',
		queryParams: {}
	};
  
	if (query) {
	  const queryFields = query.substring(1).split('&');
	  queryFields.forEach(field => {
		const [key, value] = field.split('=');
		json.queryParams[key] = value;
	  });
	}
  
	return json;
}


/**
 * 
 * @param {string | null} hostName
 * @returns {string}
 */
export function getVLESSConfig(hostName) {
	const vlessMain = `vless://${globalConfig.userID}@${hostName}:443?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`
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
  uuid: ${globalConfig.userID}
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

