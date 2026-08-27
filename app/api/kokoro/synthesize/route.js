import { readBoundedBody, validateSynthesisRequest } from '../validation.mjs';

const KOKORO_ORIGIN = process.env.KOKORO_ORIGIN || 'http://127.0.0.1:8766';
const MAX_REQUEST_BYTES = 64_000;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_REQUEST_BYTES) return Response.json({ error: 'Request is too large' }, { status: 413 });

  let payload;
  try {
    payload = validateSynthesisRequest(await readBoundedBody(request, MAX_REQUEST_BYTES));
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.message === 'Request is too large.' ? 413 : 400 });
  }

  try {
    const upstream = await fetch(`${KOKORO_ORIGIN}/api/synthesize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
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
