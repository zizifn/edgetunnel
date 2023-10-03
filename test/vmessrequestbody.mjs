// node js
// hex to 

// https://xtls.github.io/development/protocols/vmess.html#%E9%80%9A%E8%AE%AF%E8%BF%87%E7%A8%8B
import { Buffer } from 'node:buffer'
import { webcrypto, createHash, createHmac, createCipheriv, createDecipheriv } from "node:crypto"
import CryptoJS from "crypto-js"
import AES from 'aes';


//https://xtls.github.io/development/protocols/vmess.html#%E6%95%B0%E6%8D%AE%E9%83%A8%E5%88%86
// NewShakeSizeParser use requestBodyIV
const shake128 = createHash('SHAKE128', { outputLength: 128 })
shake128.update(Buffer.from("4f11d559301ac63b9f1da0566a2c9a50", "hex")) // requestBodyIV
const mask = shake128.digest()
console.log("hex", mask.toString("hex"));
console.log(mask.readUint16BE(0));
// length (2 byte)-->df 1e
const size = Buffer.from("2113", "hex").readUInt16BE(0)
console.log(size);
const realSize = mask.readUint16BE(0) ^ size;
console.log(realSize);


console.log("mask2", mask.readUint16BE(2));
const size2 = Buffer.from("daca", "hex").readUInt16BE(0)
console.log("size2", size2);
const realSize2 = mask.readUint16BE(2) ^ size2;
console.log("realSize2", realSize2);



// vmess respone
// https://xtls.github.io/development/protocols/vmess.html#%E6%9C%8D%E5%8A%A1%E5%99%A8%E5%BA%94%E7%AD%94
