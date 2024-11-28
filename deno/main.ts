import {globalConfig, vlessOverWSHandler, getVLESSConfig} from '../src/worker-neo.js'
import {onDenoStart} from './denoplatform.ts'
onDenoStart();

const portString = Deno.env.get("PORT") || '8000';
Deno.serve({port: Number(portString)}, (req) => {
	if (req.headers.get("upgrade") === "websocket") {
		const upgradeResult = Deno.upgradeWebSocket(req);
		upgradeResult.socket.binaryType = 'arraybuffer';
		upgradeResult.socket.onopen = () => {
			const earlyData = req.headers.get('sec-websocket-protocol');
			vlessOverWSHandler(upgradeResult.socket, earlyData || '');
		};
		return upgradeResult.response;
	}


	const reqURL = new URL(req.url);
	const hostname = reqURL.hostname;
	const path_config = '/' + globalConfig.userID;
	const path_qrcode = '/' + globalConfig.userID + '.html';
	console.log(reqURL.pathname);
	switch (reqURL.pathname) {
		case path_config:
			return new Response(getVLESSConfig(hostname), {
				status: 200,
				headers: {
					'content-type': 'text/plain;charset=UTF-8',
				},
			});
		case path_qrcode: {
			const vlessMain = `vless://${globalConfig.userID}@${hostname}:443?encryption=none&security=tls&sni=${hostname}&fp=randomized&type=ws&host=${hostname}&path=%2F%3Fed%3D2048#${hostname}`
			const htmlContent = `
			<!DOCTYPE html>
			<html>
				<head>
					<meta charset="utf-8" />
					<script src="https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs/qrcode.js"></script>
				</head>
				<body>
					<div>${vlessMain}</div>
					<div id="vless_qr"></div>
					<script type="text/javascript">
						function createQRCode(elementId, qrText) {
							new QRCode(document.getElementById(elementId), {
								text: qrText,
								correctLevel: QRCode.CorrectLevel.M,
							});
						}

						createQRCode("vless_qr", "${vlessMain}");
					</script>
				</body>
			</html>
			`;

			return new Response(htmlContent, {
				status: 200,
				headers: {
					'content-type': 'text/html; charset=utf-8',
				},
			});
		}
		case '/':
			return new Response('Hello from the HTTP server!', {
				status: 200,
				headers: {
					'content-type': 'text/html; charset=utf-8',
				},
			});
		default:
			return new Response('Not found! (Code 404)', {
				status: 404
			});
	}
});
