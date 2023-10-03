import { createHash } from 'crypto';

// Create a SHA-3 hash object with a specific hash length (e.g., 256 bits)
const sha3Hash = createHash('sha3-1024');

// Update the hash with your data (can be a string or a Buffer)
const data = 'Hello, SHA-3!';
sha3Hash.update(data);

// Calculate the hash and get it as a hexadecimal string
const sha3Hex = sha3Hash.digest('hex');

console.log('SHA-3 (256-bit) Hash:', sha3Hex);
