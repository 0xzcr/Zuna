const KOKORO_ORIGIN = process.env.KOKORO_ORIGIN || 'http://127.0.0.1:8766';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 1_000_000) return Response.json({ error: 'Request is too large' }, { status: 413 });

  try {
    const upstream = await fetch(`${KOKORO_ORIGIN}/api/synthesize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: await request.text(),
      cache: 'no-store',
      signal: AbortSignal.timeout(120_000),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'Local Kokoro runtime is unavailable' }, { status: 502 });
  }
}
