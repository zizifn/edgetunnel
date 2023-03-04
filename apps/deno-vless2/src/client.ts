import {
  serveDir,
  serveFile,
} from 'https://deno.land/std@0.167.0/http/file_server.ts';
async function serveClient(req: Request, basePath: string) {
  const pathname = new URL(req.url).pathname;
  if (pathname.startsWith('/assets')) {
    const resp = await serveDir(req, {
      fsRoot: `${Deno.cwd()}/dist/apps/cf-page`,
    });
    resp.headers.set('cache-control', 'public, max-age=2592000');
    return resp;
  }
  if (pathname.includes(basePath)) {
    return await serveFile(req, `${Deno.cwd()}/dist/apps/cf-page/index.html`);
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
