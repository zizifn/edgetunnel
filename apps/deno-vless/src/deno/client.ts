import { serveDir } from 'https://deno.land/std@0.167.0/http/file_server.ts';
import { validate } from 'https://jspm.dev/npm:uuid@9.0.0';
async function serveClient(req: Request, basePath: string) {
  const pathname = new URL(req.url).pathname;
  if (pathname.startsWith('/assets')) {
    return serveDir(req, {
      fsRoot: `${Deno.cwd()}/client`,
    });
  }
  if (pathname.includes(basePath)) {
    // Do dynamic responses
    const indexHtml = await Deno.readFile(`${Deno.cwd()}/client/index.html`);
    return new Response(indexHtml, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    });
  }

  return new Response(``, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
}

export { serveClient };
