import { createServer, Socket } from 'node:net';
import { Duplex } from 'node:stream';
import { fetch } from 'undici';
import { ReadableStream, WritableStream } from 'node:stream/web';
import { Command } from 'commander';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { exit } from 'node:process';

let config: {
  port: string;
  address: string;
  uuid: string;
  config: string;
} = null;
const program = new Command();
program
  .command('run')
  .description('launch local http proxy for edge pass')
  .option(
    '--config <config>',
    'address of remote proxy, etc https://***.deno.dev/'
  )
  .option(
    '--address <address>',
    'address of remote proxy, etc https://***.deno.dev/'
  )
  .option('--port <port>', 'local port of http proxy proxy', '8134')
  .option('--uuid <uuid>', 'uuid')
  .option('--save', 'if this is pass, will save to config.json')
  .action((options) => {
    if (options.config) {
      if (existsSync(options.config)) {
        const content = readFileSync(options.config, {
          encoding: 'utf-8',
        });
        config = JSON.parse(content);
        return;
      } else {
        console.error('config not exsit!');
        exit();
      }
    }
    config = options;
    if (options.save) {
      writeFileSync('./config.json', JSON.stringify(options), {
        encoding: 'utf-8',
      });
    }
  });
program.parse();

const server = createServer();
server.on('connection', (clientToProxySocket: Socket) => {
  console.log('Client Connected To Proxy');
  // We need only the data once, the starting packet
  clientToProxySocket.once('data', async (data) => {
    // If you want to see the packet uncomment below
    // console.log(data.toString());
    let isTLSConnection = data.toString().indexOf('CONNECT') !== -1;
    let serverPort = '80';
    let serverAddress: string;
    if (isTLSConnection) {
      // Port changed if connection is TLS
      serverPort = data
        .toString()
        .split('CONNECT ')[1]
        .split(' ')[0]
        .split(':')[1];
      serverAddress = data
        .toString()
        .split('CONNECT ')[1]
        .split(' ')[0]
        .split(':')[0];
    } else {
      serverAddress = data.toString().split('Host: ')[1].split('\r\n')[0];
    }

    const {
      readable: clientToProxySocketReadable,
      writable: clientToProxySocketWritable,
    } = Duplex.toWeb(clientToProxySocket) as any as {
      readable: ReadableStream;
      writable: WritableStream;
    };

    // console.log(serverAddress);
    if (isTLSConnection) {
      clientToProxySocket.write('HTTP/1.1 200 OK\r\n\n');
    } else {
      // TODO
      //   proxyToServerSocket.write(data);
    }

    fetch(config.address, {
      headers: {
        'x-host': serverAddress,
        'x-port': serverPort,
        'x-uuid': config.uuid,
        // "Content-Type": "text/plain",
      },
      method: 'POST',
      // body: Uint8Array.from(chunks),
      body: clientToProxySocketReadable,
      duplex: 'half',
    })
      .then((resp) => {
        console.log(
          `proxy to ${serverAddress}:${serverPort} and remote return ${resp.status}`
        );
        resp.body.pipeTo(clientToProxySocketWritable).catch((error) => {
          console.error('pipe to', JSON.stringify(error));
        });
      })
      .catch((error) => {
        console.log('fetch error', error);
      });
    clientToProxySocket.on('error', (err) => {
      console.log('CLIENT TO PROXY ERROR');
      console.log(err);
    });
  });
});

server.on('error', (err) => {
  console.log('SERVER ERROR');
  console.log(err);
  throw err;
});

server.on('close', () => {
  console.log('Client Disconnected');
});

server.listen(Number(config.port), () => {
  console.log('Server runnig at http://localhost:' + config.port);
});
