const crypto = require('crypto');

function decrypt(ciphertext, key) {
    const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
}

const ciphertext = "d381558b1b2b8d14548678aa9aeed424";
const key = "f6846e51e5470ff20985ec92a8a5a024";

const plaintext = decrypt(ciphertext, key);
console.log(plaintext);