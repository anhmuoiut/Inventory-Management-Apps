import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  lookup: vi.fn(), match: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: () => ({ from: () => ({ select: () => ({
    eq: (...args: unknown[]) => { mocks.match(...args); return { limit: mocks.lookup }; },
  }) }) }),
}));
vi.mock('@/lib/supabase/server', () => ({
  supabaseAuthClient: async () => ({ auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut } }),
}));
import { loginWithUsername } from './login';
let sequence = 0;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.lookup.mockResolvedValue({ data: [{ id: 'user-1', email: 'example@company.test', is_active: true }], error: null });
  mocks.signIn.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});
function input() { return { username: 'test' + (++sequence), password: 'local-test-password' }; }

describe('username sign-in', () => {
  it('verifies the password through Supabase without returning email or tokens', async () => {
    expect(await loginWithUsername(input())).toBeUndefined();
    expect(mocks.signIn).toHaveBeenCalledWith({ email: 'example@company.test', password: 'local-test-password' });
  });
  it('normalizes username case and safely handles underscores', async () => {
    await loginWithUsername({ username: ' Man_Tran ', password: 'test' });
    expect(mocks.match).toHaveBeenCalledWith('username', 'man_tran');
  });
  it('rejects an unknown username without attempting a sign-in', async () => {
    mocks.lookup.mockResolvedValue({ data: [], error: null });
    await expect(loginWithUsername(input())).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it('rejects inactive profiles', async () => {
    mocks.lookup.mockResolvedValue({ data: [{ id: 'user-1', email: 'example@company.test', is_active: false }], error: null });
    await expect(loginWithUsername(input())).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it('fails closed if a lookup unexpectedly returns duplicate usernames', async () => {
    mocks.lookup.mockResolvedValue({ data: [{ is_active: true }, { is_active: true }], error: null });
    await expect(loginWithUsername(input())).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it('rejects incorrect passwords with the same generic error', async () => {
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: { status: 400 } });
    await expect(loginWithUsername(input())).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
  it('clears a session if the verified user does not match the profile', async () => {
    mocks.signIn.mockResolvedValue({ data: { user: { id: 'other-user' } }, error: null });
    await expect(loginWithUsername(input())).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(mocks.signOut).toHaveBeenCalled();
  });
  it('rejects malformed input before a database lookup', async () => {
    await expect(loginWithUsername({ username: '%', password: 'test' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it('limits repeated failed attempts', async () => {
    const credentials = input();
    mocks.lookup.mockResolvedValue({ data: [], error: null });
    for (let i = 0; i < 10; i++) {
      await expect(loginWithUsername(credentials)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    }
    await expect(loginWithUsername(credentials)).rejects.toMatchObject({ code: 'LOGIN_RATE_LIMITED' });
  });
});
