const EOL = '\n';
function isPrivateIP(ip: string) {
  if (ip === 'localhost') {
    return true;
  }
  const parts = ip.split('.');
  return (
    parts[0] === '10' ||
    (parts[0] === '172' &&
      parseInt(parts[1], 10) >= 16 &&
      parseInt(parts[1], 10) <= 31) ||
    (parts[0] === '192' && parts[1] === '168')
  );
}

function buildRawHttp500(message: string) {
  const body = new TextEncoder().encode(`${message}`);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(`HTTP/1.1 500 Internal Server Error${EOL}`)
      );
      controller.enqueue(
        new TextEncoder().encode(`content-length: ${body.length}${EOL}`)
      );
      controller.enqueue(
        new TextEncoder().encode(
          `content-type: text/plain;charset=UTF-8${EOL}${EOL}`
        )
      );
      controller.enqueue(body);
      controller.close();
    },
    cancel() {},
  });
}

function isVaildateReq(request: Request) {
  const serverAddress = request.headers.get('x-host') || '';
  let isVaild = true;
  if (isPrivateIP(serverAddress) || !request.body) {
    console.log('lcoal ip or request.body is null');
    isVaild = false;
  }
  return isVaild;
}

export { isPrivateIP, buildRawHttp500, isVaildateReq };
