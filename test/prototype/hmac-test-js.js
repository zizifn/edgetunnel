const crypto = require('crypto')


function hmac_rec(data, keyList) {
	const digest = 'sha256', blockSizeOfDigest = 64
	var key = keyList.pop()
	if (keyList.length > 0) {
		// adjust key (according to HMAC specification)
		if (key.length > blockSizeOfDigest) { let k = Buffer.allocUnsafe(blockSizeOfDigest).fill('\x00'); hmac_rec(key, [...keyList]).copy(k) }
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
		var hMac = crypto.createHmac(digest, key).update(data).digest();
	}
	return hMac
}
var keyList = [Buffer.from('salt'), Buffer.from('alfa'), Buffer.from('beta'), Buffer.from('beta2')]
var data = Buffer.from('data', 'utf8')
var result = hmac_rec(data, keyList)
console.log(result.toString('hex')) 