import { Readable } from 'stream';
const readableStream = new Readable();
readableStream.push('ping!');
readableStream.push('pong!');
