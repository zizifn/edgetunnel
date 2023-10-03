import { strictEqual } from "node:assert";
import { decodeVMESSRequestHeader, uuidCmdKeyMap } from '../src/worker-vmess-beta.js';
import { createHash } from "node:crypto"

const uuid = "720bf125-9c89-4e5e-bc28-15dc910e1b66";
const cmdkey = createHash("md5").update(uuid.replaceAll('-', ''), "hex").update("c48619fe-8f02-49e0-b9e9-edf763e17e21").digest();
uuidCmdKeyMap.set(uuid, cmdkey)

const vmessHeader = `
d3 1e b4 3c 46 b3 52 20 fd 14 fb 51 03 8a 35 0f
73 a0 a7 60 5f ab 18 39 db c0 cb aa ae 68 32 a5
5f a7 0a 11 bd 2c 5d c7 c7 63 63 26 dc a5 30 4c
55 35 9c 6a 3d 68 e7 16 06 7c ea ca a8 03 5c f4
db 34 c3 b9 7a 6d 2a 5e 90 e2 56 0f 25 2e da 2f
12 c2 41 bf 04 d5 20 54 50 c1 15 7c ba 10 cc 8d
df 9e 79 c7 3a 03 68 ae 80 35 40 37 b0 4c 54 37
b3 cb b1 03 c7 21 13 16 03 01 01 1b 01 00 01 17
03 03 58 ef 38 8e 78 82 7e 21 49 17 ac ea 65 ea
54 da 8d da ea 0f 80 92 db 51 61 0d 36 95 b0 53
2f 53 20 ed dd 0b 18 46 57 6f 99 eb 14 37 80 e2
fe 36 26 cb 50 14 c9 db a5 c2 cb 75 dc 54 d4 fd
2e d4 3b 00 28 13 02 13 01 c0 2c c0 2b c0 30 c0
2f c0 24 c0 23 c0 28 c0 27 c0 0a c0 09 c0 14 c0
13 00 9d 00 9c 00 3d 00 3c 00 35 00 2f 01 00 00
a6 00 00 00 12 00 10 00 00 0d 77 77 77 2e 62 61
69 64 75 2e 63 6f 6d 00 05 00 05 01 00 00 00 00
00 2b 00 09 08 03 04 03 03 03 02 03 01 00 0d 00
1a 00 18 08 04 08 05 08 06 04 01 05 01 02 01 04
03 05 03 02 03 02 02 06 01 06 03 00 23 00 00 00
0a 00 08 00 06 00 1d 00 17 00 18 00 10 00 0b 00
09 08 68 74 74 70 2f 31 2e 31 00 33 00 26 00 24
00 1d 00 20 5c 41 0a 56 bd 77 24 94 a7 da 0f e2
90 9c d7 fa b3 ee 83 ae de 0e 54 be fb 36 22 a2
fc a2 a9 4c 00 31 00 00 00 17 00 00 ff 01 00 01
00 00 2d 00 02 01 01 `

const vmessHeaderBuffer = Buffer.from(vmessHeader.replace(/\s/g, ''), "hex")

const vmessrequestbody = vmessHeaderBuffer.subarray(117 + 2)

const vmessHeaderResult = await decodeVMESSRequestHeader(vmessHeaderBuffer, uuid)
console.log(vmessHeaderResult);
