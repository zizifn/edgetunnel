
const sizeBuffer = new Uint16Array([356]);

console.log(sizeBuffer);

const int = 356

const test = new Uint8Array([(356 >> 8) & 0xff, 356 & 0xff])

console.log(test);
