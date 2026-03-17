const FLASK = 'http://localhost:5000';

async function handler(req, { params }) {
  const path = (await params).path?.join('/') ?? '';
  const url = new URL(`${FLASK}/api/${path}`);
  req.nextUrl?.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const init = {
    method: req.method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try { init.body = JSON.stringify(await req.json()); } catch {}
  }

  const resp = await fetch(url.toString(), init);
  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: { 'Content-Type': resp.headers.get('Content-Type') || 'application/json' },
  });
}

export { handler as GET, handler as POST };
