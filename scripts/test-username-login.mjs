import { createClient } from '@supabase/supabase-js';
import { parseEnv } from 'node:util';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

const env = parseEnv(readFileSync('.env.local', 'utf8'));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const base = 'http://localhost:3000';
const username = 'ui-check-' + randomBytes(8).toString('hex');
const password = randomBytes(24).toString('base64url') + '!Aa9';
let createdId;
let cookies;
async function login(body, origin = base) {
  return fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
}
try {
  const anon = await fetch(base + '/api/equipment');
  assert.equal(anon.status, 401);
  assert.equal((await login({ username: '%', password })).status, 401);
  assert.equal((await login({ username, password }, 'https://other.example')).status, 403);

  const created = await db.auth.admin.createUser({
    email: 'email-' + username + '@example.invalid', password, email_confirm: true,
  });
  if (created.error) throw created.error;
  createdId = created.data.user.id;
  const profile = await db.from('user_profiles').insert({
    id: createdId, username, email: 'email-' + username + '@example.invalid', full_name: 'Temporary UI verification',
    role: 'viewer', is_active: true, must_change_password: false,
  });
  if (profile.error) throw profile.error;

  const incorrect = await login({ username, password: password + 'wrong' });
  assert.equal(incorrect.status, 401);
  const unknown = await login({ username: username + '-missing', password });
  assert.equal(unknown.status, 401);
  const incorrectBody = await incorrect.json();
  const unknownBody = await unknown.json();
  assert.equal(incorrectBody.error.code, unknownBody.error.code);
  assert.equal(incorrectBody.error.message, unknownBody.error.message);

  const signedIn = await login({ username: username.toUpperCase(), password });
  assert.equal(signedIn.status, 200);
  const result = await signedIn.json();
  assert.deepEqual(result.data, { signed_in: true });
  assert.equal(JSON.stringify(result).includes('example.invalid'), false);
  cookies = signedIn.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert.ok(cookies, 'Login must set session cookies');
  const me = await fetch(base + '/api/me', { headers: { Cookie: cookies } });
  assert.equal(me.status, 200);
  const who = await me.json();
  assert.equal(who.data.id, createdId);
  assert.equal(who.data.username, username);
  const dashboard = await fetch(base + '/', { headers: { Cookie: cookies }, redirect: 'manual' });
  assert.equal(dashboard.status, 200);
  const html = await dashboard.text();
  assert.ok(html.includes('Site Equipment Masterlist'));
  assert.ok(html.includes('app-sidebar'));
  assert.ok(html.includes('>' + username + '</span>'));
  const equipment = await fetch(base + '/api/equipment', { headers: { Cookie: cookies } });
  assert.equal(equipment.status, 200);
  console.log('PASS: anonymous protection, origin check, invalid credentials, independent case-insensitive username login, session cookies, authenticated dashboard and equipment API.');
} finally {
  if (createdId) {
    const removed = await db.auth.admin.deleteUser(createdId);
    if (removed.error) throw new Error('Temporary verification account cleanup failed');
    console.log('Temporary verification account removed.');
  }
}
