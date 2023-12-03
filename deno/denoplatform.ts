import {
	platformAPI,

	NodeJSUDP,
	NodeJSUDPRemoteInfo,
} from '../src/worker-neo.js'

platformAPI.connect = async (address, port) => {
	const tcpSocket = await Deno.connect({
		hostname: address,
		port: port,
		transport: 'tcp',
	});

	return {
		// A ReadableStream Object
		readable: tcpSocket.readable,
	
		// Contains functions to write to a TCP stream
		writable: tcpSocket.writable,

		// Handles socket close
		// Deno does not have a onclose callback!
		closed: new Promise<void>((resolve, reject) => {})
	};
};

platformAPI.newWebSocket = (url) => new WebSocket(url);

// deno-lint-ignore require-await
platformAPI.associate = async (isIPv6) => {
	const family = isIPv6 ? 'IPv6' : 'IPv4';

	const UDPSocket = Deno.listenDatagram({
		transport: 'udp',
		port: 0,
		hostname: isIPv6 ? '[::]' : '0.0.0.0',
	});

	let messageHandler: null | ((msg: Uint8Array, rinfo: NodeJSUDPRemoteInfo) => void) = null;
	let errorHandler: null | ((err: Error) => void) = null;

	function receivingLoop() {
		UDPSocket.receive().then(([buffer, from]) => {
			// We only support UDP datagram here
			const remoteAddress = <Deno.NetAddr> from;
	
			if (messageHandler) {
				messageHandler(buffer, {
					address: remoteAddress.hostname,
					family: family,
					port: remoteAddress.port,
					size: buffer.byteLength
				});
			}
	
			// Receive more messages
			receivingLoop();
		}).catch((err) => {
			if (errorHandler) {
				errorHandler(err);
			}
		});
	}
	receivingLoop();

	return {
		send: async (datagram, offset, length, port, address, sendDoneCallback) => {
			const addr: Deno.Addr = {
				transport: 'udp',
				hostname: address,
				port
			};

			const buffer = new Uint8Array(datagram, offset, length);

			try {
				const bytesSent = await UDPSocket.send(buffer, addr);
				sendDoneCallback(null, bytesSent);
			} catch (err) {
				sendDoneCallback(err, 0);
				if (errorHandler) {
					errorHandler(err);
				}
			}
		},
		close: () => {
			UDPSocket.close();
		},
		onmessage: (handler) => {
			messageHandler = handler;
		},
		onerror: (handler) => {
			errorHandler = handler;
		}
	} as NodeJSUDP;
}

export function onDenoStart() {
	
}