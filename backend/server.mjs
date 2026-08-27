import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

function now() { return new Date().toISOString(); }

function apiError(code, message, details) {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

function sendJson(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body is too large'), { code: 'BODY_TOO_LARGE' }));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on('end', () => {
      if (!body.trim()) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch { reject(Object.assign(new Error('Request body must be valid JSON'), { code: 'INVALID_JSON' })); }
    });
    request.on('error', reject);
  });
}

function validateUser(input) {
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { error: apiError('VALIDATION_ERROR', 'A valid email is required.', { field: 'email' }) };
  }
  return { value: { email } };
}

function validateBook(input) {
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  const sourceFormat = input?.sourceFormat;
  const userId = input?.userId ?? null;
  if (!title || title.length > 200) return { error: apiError('VALIDATION_ERROR', 'Title must be between 1 and 200 characters.', { field: 'title' }) };
  if (!['pdf', 'epub'].includes(sourceFormat)) return { error: apiError('VALIDATION_ERROR', 'Source format must be pdf or epub.', { field: 'sourceFormat' }) };
  if (userId !== null && (typeof userId !== 'string' || userId.length > 100)) return { error: apiError('VALIDATION_ERROR', 'User id must be a string or null.', { field: 'userId' }) };
  return { value: { title, sourceFormat, userId } };
}

function publicUser(user) {
  return { id: user.id, email: user.email, createdAt: user.createdAt, zunaPlusActive: user.zunaPlusActive };
}

export function createServer(options = {}) {
  const users = new Map();
  const wallets = new Map();
  const books = new Map();
  const rateBuckets = new Map();
  const allowedOrigins = new Set(options.allowedOrigins || String(process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:4173').split(',').map((origin) => origin.trim()).filter(Boolean));

  function corsHeaders(request) {
    const origin = request.headers.origin;
    if (!origin || !allowedOrigins.has(origin)) return {};
    return { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', vary: 'Origin' };
  }

  function isRateLimited(request) {
    const key = request.socket.remoteAddress || 'unknown';
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
    const recent = (rateBuckets.get(key) || []).filter((time) => time > cutoff);
    recent.push(Date.now());
    rateBuckets.set(key, recent);
    return recent.length > RATE_LIMIT_MAX;
  }

  return createHttpServer(async (request, response) => {
    const headers = { 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', ...corsHeaders(request) };
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { ...headers, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, authorization, idempotency-key' });
      response.end();
      return;
    }
    if (isRateLimited(request)) { sendJson(response, 429, apiError('RATE_LIMITED', 'Too many requests. Please try again shortly.'), { ...headers, 'retry-after': '60' }); return; }

    const url = new URL(request.url, 'http://localhost');
    try {
      if (request.method === 'GET' && url.pathname === '/health') { sendJson(response, 200, { status: 'ok', service: 'zuna-backend', time: now() }, headers); return; }
      if (request.method === 'POST' && url.pathname === '/api/v1/users') {
        const validation = validateUser(await parseJsonBody(request));
        if (validation.error) { sendJson(response, 422, validation.error, headers); return; }
        if ([...users.values()].some((user) => user.email === validation.value.email)) { sendJson(response, 409, apiError('CONFLICT', 'An account with this email already exists.'), headers); return; }
        const user = { id: randomUUID(), ...validation.value, createdAt: now(), zunaPlusActive: false };
        users.set(user.id, user);
        wallets.set(user.id, { userId: user.id, balanceSeconds: 0, updatedAt: now() });
        sendJson(response, 201, { user: publicUser(user), wallet: wallets.get(user.id) }, headers);
        return;
      }
      const walletMatch = url.pathname.match(/^\/api\/v1\/users\/([^/]+)\/wallet$/);
      if (request.method === 'GET' && walletMatch) {
        const wallet = wallets.get(walletMatch[1]);
        if (!wallet) { sendJson(response, 404, apiError('NOT_FOUND', 'User wallet not found.'), headers); return; }
        sendJson(response, 200, { wallet }, headers);
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/v1/books') {
        const validation = validateBook(await parseJsonBody(request));
        if (validation.error) { sendJson(response, 422, validation.error, headers); return; }
        if (validation.value.userId && !users.has(validation.value.userId)) { sendJson(response, 404, apiError('NOT_FOUND', 'The supplied user was not found.'), headers); return; }
        const book = { id: randomUUID(), ...validation.value, importStatus: 'queued', chapterMap: null, createdAt: now() };
        books.set(book.id, book);
        sendJson(response, 201, { book }, headers);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/v1/books') {
        const page = Math.max(1, Number(url.searchParams.get('page') || 1));
        const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') || 20)));
        const userId = url.searchParams.get('userId');
        const filtered = [...books.values()].filter((book) => userId === null || book.userId === userId);
        const data = filtered.slice((page - 1) * pageSize, page * pageSize);
        sendJson(response, 200, { data, pagination: { page, pageSize, totalItems: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)) } }, headers);
        return;
      }
      sendJson(response, 404, apiError('NOT_FOUND', 'Route not found.'), headers);
    } catch (error) {
      const status = error.code === 'BODY_TOO_LARGE' ? 413 : error.code === 'INVALID_JSON' ? 400 : 500;
      const body = status === 500 ? apiError('INTERNAL_ERROR', 'Something went wrong.') : apiError(error.code, error.message);
      sendJson(response, status, body, headers);
    }
  });
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const port = Number(process.env.PORT || 8787);
  createServer().listen(port, () => console.log(`Zuna backend listening on http://127.0.0.1:${port}`));
}
