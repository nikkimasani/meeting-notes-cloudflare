const UPSTREAM = 'https://meeting-notes-eta-ecru.vercel.app/api/';
const DROP = ['host', 'origin', 'referer', 'content-length', 'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor', 'x-forwarded-proto', 'x-real-ip'];

export async function onRequest(context) {
  const incoming = context.request;
  const path = Array.isArray(context.params.path) ? context.params.path.join('/') : String(context.params.path || '');
  const target = new URL(UPSTREAM + path);
  target.search = new URL(incoming.url).search;
  const headers = new Headers(incoming.headers);
  for (const h of DROP) headers.delete(h);
  const init = { method: incoming.method, headers, redirect: 'follow' };
  // Buffer the body so it can be safely re-sent on a redirect (streams can't be replayed).
  if (incoming.method !== 'GET' && incoming.method !== 'HEAD') init.body = await incoming.arrayBuffer();
  try {
    const upstream = await fetch(target.toString(), init);
    const out = new Headers(upstream.headers);
    out.set('cache-control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'The transcription service could not be reached. Your recording is safe; please try again shortly.' }), {
      status: 502,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  }
}
