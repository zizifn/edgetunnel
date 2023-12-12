/**
 * Defines a Cloudflare Worker compatible TCP connection.
 */
export interface CloudflareTCPConnection {
	readable: ReadableStream<Uint8Array>,
	writable: WritableStream<Uint8Array>,
	closed: Promise<void>,
}

export interface NodeJSUDPRemoteInfo {
	address: string,
	family: 'IPv4' | 'IPv6',
	port: number,
	size: number,
}

/**
 * Defines a NodeJS compatible UDP API.
 */
export interface NodeJSUDP {
	send: (datagram: any, offset: number, length: number, port: number, address: string, sendDoneCallback: (err: Error | null, bytes: number) => void) => void,
	close: () => void,
	onmessage: (handler: (msg: Uint8Array, rinfo: NodeJSUDPRemoteInfo) => void) => void,
	onerror: (handler: (err: Error) => void) => void,
}

/**
 * The base type of all outbound definitions.
 */
export interface Outbound {
	protocol: string,
	settings?: {}
}

/**
 * Represents a local outbound.
 */
export interface FreedomOutbound extends Outbound {
	protocol: 'freedom',
	settings: undefined
}

export type PortMap = {[key: number]: number};

/**
 * Represents a forwarding outbound.
 * First, the destination port of the request will be mapped according to portMap.
 * If none matches, the destination port remains unchanged.
 * Then, the request stream will be redirected to the given address.
 */
export interface ForwardOutbound extends Outbound {
	protocol: 'forward',
	address: string,
	portMap?: PortMap
}

export interface Socks5Server {
	address: string,
	port: number,
	users?: {
		user: string,
		pass: string,
	}[]
}

/**
 * Represents a socks5 outbound.
 */
export interface Socks5Outbound extends Outbound {
	protocol: 'socks',
	settings: {
		servers: Socks5Server[]
	}
}

export interface VlessServer {
	address: string,
	port: number,
	users: {
		id: string,
	}[]
}

/**
 * Represents a Vless WebSocket outbound.
 */
export interface VlessWsOutbound {
	protocol: 'vless',
	settings: {
		vnext: VlessServer[]
	},
	streamSettings: StreamSettings
}

export interface StreamSettings {
	network: 'ws',
	security: 'none' | 'tls',
	wsSettings?: {
		path?: string,
		headers?: {
			Host: string
		}
	}
	tlsSettings?: {
		serverName: string,
		allowInsecure: boolean,
	}
}

export interface OutboundContext {
	enforceUDP: boolean,
	forwardDNS: boolean,
	log: LogFunction,
	firstChunk: Uint8Array,
}

export type OutboundHanderReturns = Promise<{
	readableStream: ReadableStream<Uint8Array>,
	writableStream: WritableStream<Uint8Array>,
}>;

export type OutboundHandler = (vlessRequest: ProcessedVlessHeader, context: OutboundContext) => OutboundHanderReturns;

export interface OutboundInstance {
	protocol: string,
	handler: OutboundHandler,
}

export interface ForwardInstanceArgs {
	proxyServer: string,
	portMap?: PortMap,
}

export interface Socks5InstanceArgs {
	address: string,
	port: number,
	user?: string,
	pass?: string,
}

export interface VlessInstanceArgs {
	address: string,
	port: number,
	uuid: string,
	streamSettings: StreamSettings,
}

export interface ProcessedVlessHeader {
	addressRemote: string;
	addressType: number;
	portRemote: number;
	rawDataIndex: number;
	vlessVersion: Uint8Array;
	isUDP: boolean;
}

export type LogFunction = (...args: any[]) => void;

// API starts ------------------------------------------------------------------------------------

export interface PlatformAPI {
	/** 
	 * A wrapper for the TCP API, should return a Cloudflare Worker compatible socket.
	 * The result is wrapped in a Promise, as in some platforms, the socket creation is async.
	 * See: https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/
	 */
	connect: (host: string, port: number) => Promise<CloudflareTCPConnection>,

	/** 
	 * A wrapper for the Websocket API.
	 */
	newWebSocket: (url: string) => WebSocket,

	/** 
	 * A wrapper for the UDP API, should return a NodeJS compatible UDP socket.
	 * The result is wrapped in a Promise, as in some platforms, the socket creation is async.
	 */
	associate: null | ((isIPv6: boolean) => Promise<NodeJSUDP>),

	/**
	 * An optional processor to process the incoming WebSocket request and its response.
	 * The response processor may need to be created multiple times before truly utilization.
	 * @type { }
	 */
	processor: null | ((logger: LogFunction) => {
		request: TransformStream<Uint8Array, Uint8Array>,
		response: () => TransformStream<Uint8Array, Uint8Array>,
	}),
}

export interface GlobalConfig {
	/** The UUID used in Vless authentication. */
	userID: string,

	/** Time to wait before an outbound Websocket connection is considered timeout, in ms. */
	openWSOutboundTimeout: number,

	/**
	 * Since Cloudflare Worker does not support UDP outbound, we may try DNS over TCP.
	 * Set to an empty string to disable UDP to TCP forwarding for DNS queries.
	 */
	dnsTCPServer: string,

	/** The order controls where to send the traffic after the previous one fails. */
	outbounds: Outbound[], 
}

declare const globalConfig: GlobalConfig;
declare const platformAPI: PlatformAPI;

/** 
 * Setup the config (uuid & outbounds) from environmental variables.
 * This is the simplest case and should be preferred where possible.
 */
declare function setConfigFromEnv(env: {
	UUID?: string, 

	/** e.g. 114.51.4.0 */
	PROXYIP?: string,

	/** e.g. {443:8443} */
	PORTMAP?: string,

	/** e.g. vless://uuid@domain.name:port?type=ws&security=tls */
	VLESS?: string,

	/** e.g. user:pass@host:port or host:port */
	SOCKS5?: string,
}): void;

declare function getVLESSConfig(hostName?: string): string;

/** 
 * If you use this file as an ES module, you call this function whenever your Websocket server accepts a new connection. 
 * @param webSocket The established websocket connection, must be an accepted.
 * @param earlyDataHeader for ws 0rtt, an optional field "sec-websocket-protocol" in the request header 
 * may contain some base64 encoded data.
 * @returns status code
 */
declare function vlessOverWSHandler(webSocket: WebSocket, earlyDataHeader: string): number;

declare function redirectConsoleLog(logServer: string, instanceId: string): void;
