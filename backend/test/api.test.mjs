import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from '../server.mjs';

async function startTestServer() {
  const server = createServer({ allowedOrigins: ['http://127.0.0.1:4173'] });
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function stopTestServer(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test('creates a user with a zero-second wallet', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const response = await fetch(`${baseUrl}/api/v1/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'reader@example.com' }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.user.email, 'reader@example.com');
    assert.equal(body.wallet.balanceSeconds, 0);
  } finally {
    await stopTestServer(server);
  }
});

test('rejects malformed user input with the shared error shape', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const response = await fetch(`${baseUrl}/api/v1/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.equal(typeof body.error.message, 'string');
  } finally {
    await stopTestServer(server);
  }
});

test('creates a book record without requiring a guest account', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const response = await fetch(`${baseUrl}/api/v1/books`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'The Listening Room', sourceFormat: 'pdf' }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.book.title, 'The Listening Room');
    assert.equal(body.book.userId, null);
    assert.equal(body.book.sourceFormat, 'pdf');
  } finally {
    await stopTestServer(server);
  }
});
