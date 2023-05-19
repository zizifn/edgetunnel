import { index401, page404 } from './util';
import { parse, stringify, validate } from 'uuid';

async function errorHandling(context: EventContext<any, any, any>) {
  try {
    return await context.next();
  } catch (err) {
    return new Response(`${err.message}\n${err.stack}`, { status: 500 });
  }
}

async function authentication(
  context: EventContext<
    any,
    any,
    {
      digestUUID: string;
    }
  >
) {
  // context.data It’s an arbitrary object you can attach data to that will persist during the request. The most common use-cases are for middleware that handles auth and may need to set context.data.username or similar.
  // if not set UUID, return 401 page
  const userID = context.env['UUID'] || '';
  let isVaildUser = validate(userID);
  if (!isVaildUser) {
    return new Response(index401, {
      status: 401,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    });
  }
  // skip authentication
  const url = new URL(context.request.url);
  if (
    // if url has uuid, skip auth
    context.request.url.includes(userID)
  ) {
    return context.next();
  }
  // static page
  const basicAuth = context.request.headers.get('Authorization') || '';
  const authString = basicAuth.split(' ')?.[1] || '';
  if (!atob(authString).includes(userID)) {
    return new Response(``, {
      status: 401,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'WWW-Authenticate': 'Basic',
      },
    });
  } else {
    const url = new URL(context.request.url);
    if (url.pathname === '/') {
      const wspath = `/vless/${userID}`;
      return new Response(``, {
        status: 302,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          Location: `./${userID}?wspath=${encodeURIComponent(wspath)}`,
        },
      });
    }
    if (url.pathname.startsWith('/assets')) {
      return context.next();
    }
    return new Response(page404, {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    });
  }
}

export const onRequest = [errorHandling, authentication];
