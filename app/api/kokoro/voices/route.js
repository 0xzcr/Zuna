const KOKORO_ORIGIN = process.env.KOKORO_ORIGIN || 'http://127.0.0.1:8766';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const upstream = await fetch(`${KOKORO_ORIGIN}/api/voices`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'Local Kokoro runtime is unavailable' }, { status: 502 });
  }
}
