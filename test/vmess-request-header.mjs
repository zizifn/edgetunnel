import { strictEqual } from "node:assert";
import { decodeVMESSRequestHeader, uuidCmdKeyMap } from '../src/worker-vmess-beta.js';
import { createHash } from "node:crypto"

const uuid = "720bf125-9c89-4e5e-bc28-15dc910e1b66";
const cmdkey = createHash("md5").update(uuid.replaceAll('-', ''), "hex").update("c48619fe-8f02-49e0-b9e9-edf763e17e21").digest();
uuidCmdKeyMap.set(uuid, cmdkey)

const vmessHeader = `
81 b8 ef 9e a0 91 1a d6 7d cb 28 1c d3 7d 1e 9d
d0 b4 57 a8 87 d6 67 4d 07 ce 89 67 55 44 f1 91
a6 88 ef f2 3f 16 03 a4 87 61 ce e2 d4 89 e6 68
0c 0f 49 09 33 0c 67 2a 31 f0 b9 bb 2f 5d 22 6b
cc 2f 12 c1 1f 91 62 fe 35 d6 1a 13 8d da 5f 4c
b0 9d 1c 66 60 54 42 15 8f 7d 69 7a 13 5b 04 63
e2 fc 1a 9b 01 0f 2a 29 23 35 3a 25 67 ea df f7
c7 59 c0 f8 71 36 8b 5b d4 17 39 06 01 58 f5 0a
c7 12 16 03 01 01 1b 01 00 01 17 03 03 3e da cb
7f 61 71 cf b1 96 22 77 c7 c8 34 d2 0c 5f 76 3b
96 09 52 46 95 e0 83 90 4f bb 88 81 e9 20 2c 98
17 22 3e 8f dd 3a 38 11 e3 57 6d c4 78 de 30 b5
25 18 a3 c5 63 f4 5a b0 b6 55 51 1a d6 1c 00 28
13 02 13 01 c0 2c c0 2b c0 30 c0 2f c0 24 c0 23
c0 28 c0 27 c0 0a c0 09 c0 14 c0 13 00 9d 00 9c
00 3d 00 3c 00 35 00 2f 01 00 00 a6 00 00 00 12
00 10 00 00 0d 77 77 77 2e 62 61 69 64 75 2e 63
6f 6d 00 05 00 05 01 00 00 00 00 00 2b 00 09 08
03 04 03 03 03 02 03 01 00 0d 00 1a 00 18 08 04
08 05 08 06 04 01 05 01 02 01 04 03 05 03 02 03
02 02 06 01 06 03 00 23 00 00 00 0a 00 08 00 06
00 1d 00 17 00 18 00 10 00 0b 00 09 08 68 74 74
70 2f 31 2e 31 00 33 00 26 00 24 00 1d 00 20 cb
ea ad 37 91 5f 27 ea 8a ba 02 b7 bf 6c df 90 a5
60 a0 b1 f0 f3 ea 8c 96 bd 16 00 3f 0d d8 53 00
31 00 00 00 17 00 00 ff 01 00 01 00 00 2d 00 02
01 01 `

const vmessHeaderBuffer = Buffer.from(vmessHeader.replace(/\s/g, ''), "hex")

const vmessrequestbody = vmessHeaderBuffer.subarray(117 + 2)

const vmessHeaderResult = await decodeVMESSRequestHeader(vmessHeaderBuffer, uuid)
console.log(vmessHeaderResult);



