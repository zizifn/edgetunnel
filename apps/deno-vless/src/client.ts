async function serveClient(req: Request, basePath: string) {
  const url = new URL(req.url)
  if (url.pathname.startsWith('/assets') || url.pathname.includes(basePath)) {
    // const resp = await serveDir(req, {
    //   fsRoot: `${Deno.cwd()}/dist/apps/cf-page`,
    // });
    // resp.headers.set('cache-control', 'public, max-age=2592000');
    let targetUrl = `https://raw.githubusercontent.com/zizifn/edgetunnel/main/dist/apps/cf-page${url.pathname}`;
    if(url.pathname.includes(basePath)){
      targetUrl = `https://raw.githubusercontent.com/zizifn/edgetunnel/main/dist/apps/cf-page/index.html`;
    }
    console.log(targetUrl)
    const resp = await fetch(targetUrl);
    const modifiedHeaders = new Headers(resp.headers);
    modifiedHeaders.delete('content-security-policy');
    if(url.pathname.endsWith('.js')){
      modifiedHeaders.set('content-type', 'application/javascript');
    }else if(url.pathname.endsWith('.css')){
      modifiedHeaders.set('content-type', 'text/css');
    }else if(url.pathname.includes(basePath)){
      modifiedHeaders.set('content-type', 'text/html; charset=utf-8');

    }
    return new Response(
      resp.body,
      {
        status: resp.status,
        headers: modifiedHeaders
      }
    );
  }
  const basicAuth = req.headers.get('Authorization') || '';
  const authString = basicAuth.split(' ')?.[1] || '';
  if (atob(authString).includes(basePath)) {
    console.log('302');
    return new Response(``, {
      status: 302,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        Location: `./${basePath}`,
      },
    });
  } else {
    return new Response(``, {
      status: 401,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'WWW-Authenticate': 'Basic',
      },
    });
  }
}

export { serveClient };
