import { index401 } from './util';
import { parse, stringify, validate } from 'uuid';
const skipUrls = ['ws'];

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
  if (skipUrls.filter((url) => context.request.url.endsWith(url)).length) {
    return context.next();
  }
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
    return context.next();
  }
}

export const onRequest = [errorHandling, authentication];
