import { describe, expect, it } from 'vitest';
import { normalizeUsername, safeLoginDestination } from './username';

describe('username and login redirects', () => {
  it('normalizes the existing admin username', () => {
    expect(normalizeUsername('  Academy.ManTranQP2507 ')).toBe('academy.mantranqp2507');
  });
  it.each(['user@example.com', '%', 'a b', '', 'a'.repeat(65), null])('rejects invalid usernames: %s', value => {
    expect(normalizeUsername(value)).toBeNull();
  });
  it('preserves underscores for exact username matching', () => {
    expect(normalizeUsername('Man_Tran')).toBe('man_tran');
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/login', '/\n/evil.example'])('rejects unsafe return URLs: %s', value => {
    expect(safeLoginDestination(value)).toBe('/');
  });
  it('preserves a same-origin destination', () => {
    expect(safeLoginDestination('/?search=fixture')).toBe('/?search=fixture');
  });
});
