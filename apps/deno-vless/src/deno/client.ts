import {
  serveDir,
  serveFile,
} from 'https://deno.land/std@0.167.0/http/file_server.ts';
async function serveClient(req: Request, basePath: string) {
  for await (const entry of Deno.readDir('.')) {
    console.log(entry);
  }
  const pathname = new URL(req.url).pathname;
  if (pathname.startsWith('/assets')) {
    const resp = await serveDir(req, {
      fsRoot: `${Deno.cwd()}/apps/deno-vless/src/client`,
    });
    resp.headers.set('cache-control', 'public, max-age=2592000');
    return resp;
  }
  if (pathname.includes(basePath)) {
    return await serveFile(
      req,
      `${Deno.cwd()}/apps/deno-vless/src/client/index.html`
    );
    // Do dynamic responses
    // const indexHtml = await Deno.readFile(`${Deno.cwd()}/client/index.html`);
    // return new Response(indexHtml, {
    //   headers: {
    //     'content-type': 'text/html; charset=utf-8',
    //   },
    // });
  }

  return new Response(``, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
}

export { serveClient };
