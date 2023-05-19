import { connect, Socket } from 'node:net';
import { Duplex } from 'node:stream';
import { WritableStream } from 'node:stream/web';

try {
  const socket = connect(
    {
      port: '443',
      host: 'www.google.com',
    },
    () => {
      console.log('connect ', socket.readyState);
    }
  );
} catch (err) {
  console.log('----', err);
}

console.log('end');
