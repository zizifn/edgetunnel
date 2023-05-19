const a = new Uint8Array([1, 2]);

console.log(a);
console.log(a.buffer);

const b = Buffer.from([1, 2]);

console.log(b);
console.log(b.buffer);

function base64ToArrayBuffer(base64Str) {
  console.log(base64Str);
  try {
    // go use modified Base64 for URL rfc4648 which js atob nor support
    base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
    console.log(base64Str);
    const decode = atob(base64Str);
    console.log(decode);
    const arrybuffer = Uint8Array.from(decode, (c) => c.charCodeAt(0)).buffer;
    return;
  } catch (error) {
    console.log(error);
    return null;
  }
}
const str = base64ToArrayBuffer(
  'AOKDkCEjE0J_l3yhsd7Hms4AAQG7Ag13d3cuYmFpZHUuY29tFgMDALwBAAC4AwNj_iSlI337rp-44I2NpQTGV00LB8ckDg17QcGu3fNkoAAAJMAswCvAMMAvwCTAI8AowCfACsAJwBTAEwCdAJwAPQA8ADUALwEAAGsAAAASABAAAA13d3cuYmFpZHUuY29tAAUABQEAAAAAAAoACAAGAB0AFwAYAAsAAgEAAA0AGgAYCAQIBQgGBAEFAQIBBAMFAwIDAgIGAQYDACMAAAAQAAsACQhodHRwLzEuMQAXAAD_AQABAA'
);
