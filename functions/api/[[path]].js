export async function onRequest(context) {
  const incoming = context.request;
  const path = Array.isArray(context.params.path) ? context.params.path.join('/') : String(context.params.path || '');
  const target = new URL('https://meeting-notes-eta-ecru.vercel.app/api/' + path);
  target.search = new URL(incoming.url).search;
  const headers = new Headers(incoming.headers);
  headers.delete('host');
  const init = { method: incoming.method, headers, redirect: 'follow' };
  if (incoming.method !== 'GET' && incoming.method !== 'HEAD') init.body = incoming.body;
  return fetch(target.toString(), init);
}
