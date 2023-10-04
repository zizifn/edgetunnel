// node js
// hex to 

// https://xtls.github.io/development/protocols/vmess.html#%E9%80%9A%E8%AE%AF%E8%BF%87%E7%A8%8B
import { Buffer } from 'node:buffer'
import { webcrypto, createHash, createHmac, createCipheriv, createDecipheriv } from "node:crypto"
import CryptoJS from "crypto-js"
import AES from 'aes';

// 1. authid(16 byte) -->aa861354acf234507b60981949b54804
// uuid: 720bf125-9c89-4e5e-bc28-15dc910e1b66
// 1.1 cmdKey: 85f5829b4c3701bb02bdd4d5f7938b71
const cmdkey = createHash("md5").update("720bf1259c894e5ebc2815dc910e1b66", "hex").update("c48619fe-8f02-49e0-b9e9-edf763e17e21").digest(); //
console.log(cmdkey); // 85f5829b4c3701bb02bdd4d5f7938b71
// 1.2 aeskey for decrypy authid to ge time, radnom and etc f6846e51e5470ff20985ec92a8a5a024
// aeskey  = hmac(cmdkey)
const KDFSaltConstVMessAEADKDF = "VMess AEAD KDF";
const KDFSaltConstAuthIDEncryptionKey = "AES Auth ID Encryption";
const KDFSaltConstVMessHeaderPayloadLengthAEADKey = "VMess Header AEAD Key_Length"
const KDFSaltConstVMessHeaderPayloadLengthAEADIV = "VMess Header AEAD Nonce_Length"
const KDFSaltConstVMessHeaderPayloadAEADKey = "VMess Header AEAD Key"
const KDFSaltConstVMessHeaderPayloadAEADIV = "VMess Header AEAD Nonce"
let keyList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstAuthIDEncryptionKey)]
/** @type{Buffer} */
const aeskey = hmac_rec(cmdkey, [...keyList]).subarray(0, 16);
console.log("aeskey ", aeskey.toString("hex")); // f6846e51e5470ff20985ec92a8a5a024
const aeskey2 = await hmac_rec2(cmdkey, [...keyList])
console.log(aeskey2);
console.log("aeskey ", aeskey2.toString("hex")); // f6846e51e5470ff20985ec92a8a5a024

const ct = [0xd31eb43c, 0x46b35220, 0xfd14fb51, 0x038a350f]
const key = [0xf6846e51, 0xe5470ff2, 0x0985ec92, 0xa8a5a024]
const testKey = groupBufferBy4byte(aeskey)
console.log(testKey);
console.log(testKey.buffer);
console.log('------------', Uint32Array.from(key));
var aes = new AES(testKey);
console.dir(Array.from(aes.decrypt(ct)))
console.dir(new Uint32Array(aes.decrypt(ct)))
console.dir(Buffer.from(new Uint32Array(aes.decrypt(ct)).buffer))

console.dir(Array.from(aes.decrypt(ct)).map(num => num.toString(16).padStart(8, '0')).join(''));


// 2. OpenVMessAEADHeader

// 2.1 payloadHeaderLengthAEADEncrypted(18 bytes) 0f9829073ed159c3b9653d182d98717691f1
// 2.2 nonce(8 bytes) 8f88be3d980ed2f8
const payloadHeaderLengthAEADEncrypted = Buffer.from("1e8ccb4a0eb3cfac6b7c8034222db4c7abae", 'hex');
const nonceForOpenVMessAEADHeader = Buffer.from("d0244ddf096602e1", 'hex');
const authIDForOpenVMessAEADHeader = Buffer.from("2e3866c600bf0b99eb698fa2f4ea583e", 'hex')
keyList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstVMessHeaderPayloadLengthAEADKey), authIDForOpenVMessAEADHeader, nonceForOpenVMessAEADHeader]
const payloadHeaderLengthAEADKey = hmac_rec(cmdkey, keyList).subarray(0, 16);
console.log("payloadHeaderLengthAEADKey--", payloadHeaderLengthAEADKey);
keyList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstVMessHeaderPayloadLengthAEADIV), authIDForOpenVMessAEADHeader, nonceForOpenVMessAEADHeader]
const payloadHeaderLengthAEADNonce = hmac_rec(cmdkey, keyList).subarray(0, 12);
console.log("payloadHeaderLengthAEADNonce--", payloadHeaderLengthAEADNonce);

// aes-gcm
const aesGCMPayloadHeaderLengthAlgorithm = { name: 'AES-GCM', iv: payloadHeaderLengthAEADNonce, additionalData: authIDForOpenVMessAEADHeader };
const payloadHeaderLengthGCMKEY =
    await webcrypto.subtle.importKey('raw', payloadHeaderLengthAEADKey, 'AES-GCM', false, ['decrypt']);
const decryptedAEADHeaderLengthPayload = await webcrypto.subtle.decrypt(aesGCMPayloadHeaderLengthAlgorithm, payloadHeaderLengthGCMKEY, payloadHeaderLengthAEADEncrypted);
console.log("decryptedAEADHeaderLengthPayload---", decryptedAEADHeaderLengthPayload); // 0x0041 VMESS header length, need + 16 == AEAD Tag size

const payloadHeaderAEADEncrypted = Buffer.from("6d7094d1cdb86084f8169cf364b23e724ac9fac7cdf50a7a8f97766c0539424c3faf03ce56d932a12ab85aa659b35b2c9bc74c3687aa0061dac9f60c6ea468563cfa73560d707097620d4496045c", "hex");

keyList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstVMessHeaderPayloadAEADKey), authIDForOpenVMessAEADHeader, nonceForOpenVMessAEADHeader]
const payloadHeaderAEADKey = hmac_rec(cmdkey, keyList).subarray(0, 16);
keyList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstVMessHeaderPayloadAEADIV), authIDForOpenVMessAEADHeader, nonceForOpenVMessAEADHeader]
const payloadHeaderAEADIV = hmac_rec(cmdkey, keyList).subarray(0, 12);
console.log(`payloadHeaderAEADKey: ${payloadHeaderAEADKey.toString("hex")}, payloadHeaderAEADIV: ${payloadHeaderAEADIV.toString("hex")}`);

// aes-gcm
const aesGCMPayloadHeaderAlgorithm = { name: 'AES-GCM', iv: payloadHeaderAEADIV, additionalData: authIDForOpenVMessAEADHeader };
const payloadHeaderGCMKEY =
    await webcrypto.subtle.importKey('raw', payloadHeaderAEADKey, 'AES-GCM', false, ['decrypt']);
/** @type{ArrayBuffer} */
let decryptedAEADHeaderPayload = await webcrypto.subtle.decrypt(aesGCMPayloadHeaderAlgorithm, payloadHeaderGCMKEY, payloadHeaderAEADEncrypted);
console.log("OpenVMessAEADHeader: ", decryptedAEADHeaderPayload); // 

decryptedAEADHeaderPayload = Buffer.from("011df6ae07906e168e2b6cb0d81d1eb9ebb5e14bf5c9f8d89d840e3b5d363a319f8a0525000101bb020d7777772e62616964752e636f6d32f61563a59f", "hex")
// VMESS Header 01 
// 9eec8e30effd2c2b254dc6596aaf0f5a 
// ae75068dcbfb028cc54309a7eaa9bf36
// a6-->responseHeader
// 05 -->option
// 65 --> paddingLen(4 bit)[0x65 >> 4] | security(4 bit)[0x65 & 0x0F]
// 00
// 01 --> command
// 01bb --> 443
// 02 --> address type
// 0d --> if is domain, length of domain
// 7777772e62616964752e636f6d --> www.baidu.com
// cc5f1024266e1 --> padding
// 833b116 --> check sum

// https://xtls.github.io/development/protocols/vmess.html#%E5%AE%A2%E6%88%B7%E7%AB%AF%E8%AF%B7%E6%B1%82
const version = 0x01;
const requestBodyIV = decryptedAEADHeaderPayload.slice(1, 17);
console.log(requestBodyIV);
const requestBodyKey = decryptedAEADHeaderPayload.slice(17, 33);
console.log(requestBodyKey);
const responseHeader = decryptedAEADHeaderPayload.slice(33, 34);
console.log(responseHeader);
const option = decryptedAEADHeaderPayload.slice(34, 35)
console.log(option);
const paddingLen = new Uint8Array(decryptedAEADHeaderPayload.slice(35, 36))[0] >> 4; // 0x65 >> 4 = 0x6
console.log(paddingLen);
// 0: "UNKNOWN",
// 1: "LEGACY",
// 2: "AUTO",
// 3: "AES128_GCM",
// 4: "CHACHA20_POLY1305",
// 5: "NONE",
// 6: "ZERO",
const security = new Uint8Array(decryptedAEADHeaderPayload.slice(35, 36))[0] & 0x0F; // 0x65 & 0x0F = 0x6
console.log(security);
const reserved = decryptedAEADHeaderPayload.slice(36, 37)
const command = decryptedAEADHeaderPayload.slice(37, 38) //  0x01--tcp 0x02--UDP 0x03--mux
console.log(command);
const port = decryptedAEADHeaderPayload.slice(38, 40) // port 0x01bb == 443
console.log(port);
// 1--> ipv4  addressLength =4
// 2--> domain name addressLength=addressBuffer[1]
// 3--> ipv6  addressLength =16
const addressType = decryptedAEADHeaderPayload.slice(40, 41)
console.log("addressType: ", addressType);
// if is domain, next btye is length of domain
const addressLength = decryptedAEADHeaderPayload.slice(41, 42)[0];
console.log("addressLength: ", addressLength);

let index = 42 + addressLength + paddingLen;

const padding = decryptedAEADHeaderPayload.slice(42, 42 + addressLength + paddingLen)
const checkSum = decryptedAEADHeaderPayload.slice(index, index + 4)
console.log(checkSum);


//https://xtls.github.io/development/protocols/vmess.html#%E6%95%B0%E6%8D%AE%E9%83%A8%E5%88%86
// NewShakeSizeParser use requestBodyIV
const shake128 = createHash('SHAKE128', { outputLength: 128 })
shake128.update(Buffer.from("1df6ae07906e168e2b6cb0d81d1eb9eb", "hex")) // requestBodyIV
const mask = shake128.digest().toString("hex")
console.log(mask);
// length (2 byte)-->df 1e
const size = Buffer.from("df1e", "hex").readUInt16BE(0)
const realSize = mask ^ size;


// vmess respone
// https://xtls.github.io/development/protocols/vmess.html#%E6%9C%8D%E5%8A%A1%E5%99%A8%E5%BA%94%E7%AD%94






















//#region help method
function hmac_rec(data, keyList) {
    const digest = 'sha256', blockSizeOfDigest = 64
    var key = keyList.pop()
    if (keyList.length > 0) {
        let k = null;
        // adjust key (according to HMAC specification)
        if (key.length > blockSizeOfDigest) { k = Buffer.allocUnsafe(blockSizeOfDigest).fill('\x00'); hmac_rec(key, [...keyList]).copy(k) }
        else if (key.length < blockSizeOfDigest) { k = Buffer.allocUnsafe(blockSizeOfDigest).fill('\x00'); key.copy(k) }
        else k = key
        // create 'key xor ipad' and 'key xor opad' (according to HMAC specification)  
        var ik = Buffer.allocUnsafe(blockSizeOfDigest), ok = Buffer.allocUnsafe(blockSizeOfDigest)
        k.copy(ik); k.copy(ok)
        for (var i = 0; i < ik.length; i++) { ik[i] = 0x36 ^ ik[i]; ok[i] = 0x5c ^ ok[i] }
        // calculate HMac(HMac)
        var innerHMac = hmac_rec(Buffer.concat([ik, data]), [...keyList])
        var hMac = hmac_rec(Buffer.concat([ok, innerHMac]), [...keyList])
    } else {
        // calculate regular HMac(Hash)
        var hMac = createHmac(digest, key).update(data).digest();
    }
    return hMac
}
//#endregion

async function hmac_rec2(data, keyList) {
    const digest = 'SHA-256', blockSizeOfDigest = 64
    var key = keyList.pop()
    if (keyList.length > 0) {
        let k = null;
        // adjust key (according to HMAC specification)
        if (key.length > blockSizeOfDigest) { k = Buffer.allocUnsafe(blockSizeOfDigest).fill('\x00'); (await hmac_rec2(key, [...keyList])).copy(k) }
        else if (key.length < blockSizeOfDigest) { k = Buffer.allocUnsafe(blockSizeOfDigest).fill('\x00'); key.copy(k) }
        else k = key
        // create 'key xor ipad' and 'key xor opad' (according to HMAC specification)  
        var ik = Buffer.allocUnsafe(blockSizeOfDigest), ok = Buffer.allocUnsafe(blockSizeOfDigest)
        k.copy(ik); k.copy(ok)
        for (var i = 0; i < ik.length; i++) { ik[i] = 0x36 ^ ik[i]; ok[i] = 0x5c ^ ok[i] }
        // calculate HMac(HMac)
        var innerHMac = await hmac_rec2(Buffer.concat([ik, data]), [...keyList])
        var hMac = await hmac_rec2(Buffer.concat([ok, innerHMac]), [...keyList])
    } else {
        // calculate regular HMac(Hash)
        var keyMaterial = await webcrypto.subtle.importKey('raw', key, { name: 'HMAC', hash: digest }, false, ['sign']);
        var hMac = Buffer.from(await webcrypto.subtle.sign('HMAC', keyMaterial, data));

    }
    return hMac
}


/**
 * 
 * @param {Buffer} authIDKey 
 * @returns 
 */
function groupBufferBy4byte(authIDKey) {
    const result = [];
    for (let i = 0; i < authIDKey.length; i += 4) {
        result.push(authIDKey.readUInt32BE(i));
    }
    return result;
}