
import { Buffer } from 'node:buffer'

export default {
    async fetch(request, env, ctx) {
        const authIDDecryptedBuffer = Buffer.from("0000000064e9a3d089d1dd5ce56097c8", "hex");
        console.log(authIDDecryptedBuffer);
        const time = authIDDecryptedBuffer.readBigInt64BE(0);
        const rand = authIDDecryptedBuffer.readInt32BE(8);
        const crc32Zero = authIDDecryptedBuffer.readUInt32BE(12);
        const str = JSON.stringify({
            time: time.toString(),
            rand,
            crc32Zero
        })
        return new Response(str);
    },
};