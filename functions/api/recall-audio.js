// Streams a meeting-bot recording from Recall.ai's storage to the app.
// Recall's presigned links don't allow browser downloads across origins, and
// Vercel caps response size, so the audio comes through here instead.
// Only Recall/S3 hosts are allowed so this can't be used as an open proxy.
const RECALL = /(^|\.)recall\.ai$/;
const S3 = /(^|\.)s3[\w.-]*\.amazonaws\.com$/;

export async function onRequestGet({ request }) {
  const raw = new URL(request.url).searchParams.get('u') || '';
  let target;
  try { target = new URL(raw); } catch { return new Response('Bad link', { status: 400 }); }
  const signedS3 = S3.test(target.hostname) && /X-Amz-Signature|Signature=/.test(target.search);
  if (target.protocol !== 'https:' || !(RECALL.test(target.hostname) || signedS3)) return new Response('Not allowed', { status: 403 });
  const upstream = await fetch(target.toString());
  if (!upstream.ok) return new Response('Recording is not available (it may have expired).', { status: upstream.status });
  const headers = new Headers();
  headers.set('content-type', upstream.headers.get('content-type') || 'audio/mpeg');
  const len = upstream.headers.get('content-length');
  if (len) headers.set('content-length', len);
  headers.set('cache-control', 'no-store');
  return new Response(upstream.body, { status: 200, headers });
}
