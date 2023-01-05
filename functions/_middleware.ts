import { index401 } from './util';
import { parse, stringify, validate } from 'uuid';
const skipUrls = ['ws', 'assets'];

async function errorHandling(context: EventContext<any, any, any>) {
  try {
    return await context.next();
  } catch (err) {
    return new Response(`${err.message}\n${err.stack}`, { status: 500 });
  }
}

function authentication(context: EventContext<any, any, any>) {
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
  if (
    skipUrls.filter((url) => context.request.url.includes(url)).length ||
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
      return new Response(``, {
        status: 302,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          Location: `./${userID}`,
        },
      });
    } else {
      return context.next();
    }
  }
}

export const onRequest = [errorHandling, authentication];
