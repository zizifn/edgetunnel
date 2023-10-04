import { createHash } from 'crypto';
import jsSHA from "jssha";

const hash = createHash('SHAKE128', { outputLength: 8 })
hash.update('inner-key1', "utf-8")
console.log(hash.digest('hex'))


const shaObj = new jsSHA("SHAKE128", "ARRAYBUFFER");
shaObj.update(Buffer.from('1df6ae07906e168e2b6cb0d81d1eb9eb', "hex"));
console.log(shaObj.getHash("HEX", { outputLen: 8 }));
console.log(shaObj.getHash("HEX", { outputLen: 8 }));
