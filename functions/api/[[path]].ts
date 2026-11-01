interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const targetUrl = new URL(url.pathname + url.search, 'https://openscript-api-dev.onrender.com');

  const modifiedHeaders = new Headers(context.request.headers);
  modifiedHeaders.set('host', 'openscript-api-dev.onrender.com');

  const requestInit: RequestInit = {
    method: context.request.method,
    headers: modifiedHeaders,
    redirect: 'follow',
  };

  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    requestInit.body = context.request.body;
    // @ts-ignore
    requestInit.duplex = 'half';
  }

  const response = await fetch(targetUrl.toString(), requestInit);
  return response;
};
