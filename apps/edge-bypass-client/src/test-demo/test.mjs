import * as undici from 'undici';
import { pipeline, Readable, Writable } from 'node:stream';

pipeline(
  new Readable({
    read() {
      this.push(Buffer.from('undici'));
      this.push(null);
    },
  }),
  undici.pipeline(
    'http://localhost:1082',
    {
      method: 'POST',
    },
    ({ statusCode, headers, body }) => {
      console.log(`response received ${statusCode}`);
      console.log('headers', headers);
      console.log('headers', body);
      return body;
    }
  ),
  // new Writable({
  //   write(chunk) {
  //     console.log(chunk.toString());
  //   },
  // }),
  (error) => {
    console.log(error);
  }
);
