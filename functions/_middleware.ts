const skipUrls = ["ws"];

async function errorHandling(context: EventContext<any, any, any>) {
  try {
    return await context.next();
  } catch (err) {
    return new Response(`${err.message}\n${err.stack}`, { status: 500 });
  }
}

function authentication(context: EventContext<any, any, any>) {
  // skip authentication
  if (skipUrls.filter((url) => context.request.url.endsWith(url))) {
    return context.next();
  }
  const basicAuth = context.request.headers.get("Authorization") || "";
  const authString = basicAuth.split(" ")?.[1] || "";
  if (!atob(authString).includes("test")) {
    return new Response(``, {
      status: 401,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "WWW-Authenticate": "Basic",
      },
    });
  } else {
    return context.next();
  }
}

export const onRequest = [errorHandling, authentication];
