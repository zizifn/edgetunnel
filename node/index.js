// Run this on NodeJS to test edgeworker without wrangler.
// The only dependency is the ws package from npm
// To run, first run "setup.sh", then "node index.js"

import http from 'http';
import net from 'net';
import WebSocket from 'ws';
import {createSocket as createUDPSocket} from 'dgram';

import {globalConfig, platformAPI, setConfigFromEnv, vlessOverWSHandler, getVLESSConfig} from '../src/worker-with-socks5-experimental.js';

// Create an HTTP server
const server = http.createServer((req, res) => {
	switch (req.url) {
		case '/':
			res.write('Hello from the HTTP server!');
			break;
		case '/vless_config':
			res.write(getVLESSConfig('YOUR-HOSTNAME'));
			break;
		default:
			res.statusCode = 404;
	}
	res.end();
});

// Create a WebSocket server and attach it to the HTTP server
const wss = new WebSocket.Server({ server });

// Define what should happen when a new WebSocket connection is established
wss.on('connection', (ws, req) => {
	vlessOverWSHandler(ws, req.headers['sec-websocket-protocol'] || '');
});

// Start the server on port 8080
server.listen(8080);

function buf2hex(buffer) { // buffer is an ArrayBuffer
	return [...new Uint8Array(buffer)]
		.map(x => x.toString(16).padStart(2, '0'))
		.join(' ');
}

/**
 * Portable function for creating a outbound TCP connections.
 * Has to be "async" because some platforms open TCP connection asynchronously.
 * 
 * @param {string} address The remote address to connect to.
 * @param {number} port The remote port to connect to.
 * @returns {object} The wrapped TCP connection, to be compatible with Cloudflare Workers
 */
platformAPI.connect = async (address, port) => {
	const socket = net.createConnection(port, address);

	let readableStreamCancel = false;
	const readableStream = new ReadableStream({
		start(controller) {
			socket.on('data', (data) => {
				if (readableStreamCancel) {
					return;
				}
				controller.enqueue(data);
			});
		
			socket.on('close', () => {
				socket.destroy();
				if (readableStreamCancel) {
					return;
				}
				controller.close();
			});
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
			readableStreamCancel = true;
			socket.destroy();
		}
	});

	const onSocketCloses = new Promise((resolve, reject) => {
		socket.on('close', (err) => {
			if (err) {
				reject(socket.errored);
			} else {
				resolve();
			}
		});

		socket.on('error', (err) => {
			reject(err);
		});
	});

	return {
		// A ReadableStream Object
		readable: readableStream,
	
		// Contains functions to write to a TCP stream
		writable: {
			getWriter: () => {
				return {
					write: (data) => {
						socket.write(data);
					},
					releaseLock: () => {
						// console.log('Dummy writer.releaseLock()');
					}
				};
			}
		},

		// Handles socket close
		closed: onSocketCloses
	};
};

platformAPI.newWebSocket = (url) => new WebSocket(url);

platformAPI.associate = async (isIPv6) => {
	const UDPSocket = createUDPSocket(isIPv6 ? 'udp6' : 'udp4');
	return {
		send: (datagram, offset, length, port, address, sendDoneCallback) => {
			UDPSocket.send(datagram, offset, length, port, address, sendDoneCallback);
		},
		close: () => {
			UDPSocket.close();
		},
		onmessage: (handler) => {
			UDPSocket.on('message', handler);
		},
		onerror: (handler) => {
			UDPSocket.on('error', handler);
		}
	};
}

async function loadModule() {
	try {
		const customConfig = await import('./config.js');

		if (customConfig.useCustomOutbound) {
			globalConfig.outbounds = customConfig.outbounds;
		} else {
			setConfigFromEnv(customConfig.env);
			if (customConfig.forceProxy) {
				globalConfig.outbounds = globalConfig.outbounds.filter(obj => obj.protocol !== "freedom");
			}
		}
		console.log(JSON.stringify(globalConfig.outbounds));
	} catch (err) {
	  console.error('Failed to load the module', err);
	}
}

loadModule();
