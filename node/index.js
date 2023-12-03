// Run this on NodeJS to test edgeworker without wrangler.
// The only dependency is the ws package from npm
// To run, first run "setup.sh", then "node index.js"

import http from 'http';
import WebSocket from 'ws';

import {globalConfig, setConfigFromEnv, vlessOverWSHandler, getVLESSConfig} from '../src/worker-neo.js';
import {onNodeStart} from './nodeplatform.js';

onNodeStart();

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

// Start the server on port 8000
server.listen(8000);

function buf2hex(buffer) { // buffer is an ArrayBuffer
	return [...new Uint8Array(buffer)]
		.map(x => x.toString(16).padStart(2, '0'))
		.join(' ');
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
