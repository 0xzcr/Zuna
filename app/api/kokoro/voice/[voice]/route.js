import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const voicesRoot = join(process.cwd(), 'node_modules', 'kokoro-js', 'voices');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { voice } = await params;
  if (typeof voice !== 'string' || !/^[a-z]{2}_[a-z0-9_]{1,60}$/i.test(voice)) {
    return Response.json({ error: 'Invalid Kokoro voice.' }, { status: 400 });
  }

  try {
    const bytes = await readFile(join(voicesRoot, `${voice}.bin`));
    return new Response(bytes, {
      headers: {
        'cache-control': 'public, max-age=31536000, immutable',
        'content-type': 'application/octet-stream',
      },
    });
  } catch (error) {
    if (error?.code === 'ENOENT') return Response.json({ error: 'Kokoro voice asset not found.' }, { status: 404 });
    return Response.json({ error: 'Kokoro voice asset is unavailable.' }, { status: 500 });
  }
}
