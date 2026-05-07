global.Zotero = {
  Prefs: { get: () => undefined },
  debug: () => {},
  isMac: false,
};

const SUL = require('../src/swisscoveryubbernlocations');

describe('parseShortcut', () => {
  test('parses accel,alt,K', () => {
    expect(SUL.parseShortcut('accel,alt,K')).toEqual({
      accel: true, alt: true, shift: false, key: 'K',
    });
  });

  test('returns null for empty / undefined', () => {
    expect(SUL.parseShortcut('')).toBeNull();
    expect(SUL.parseShortcut(undefined)).toBeNull();
    expect(SUL.parseShortcut(null)).toBeNull();
  });

  test('returns null when only modifiers (no key)', () => {
    expect(SUL.parseShortcut('accel,shift')).toBeNull();
  });

  test('lowercases modifiers, uppercases key', () => {
    expect(SUL.parseShortcut('ACCEL, Shift, k')).toEqual({
      accel: true, alt: false, shift: true, key: 'K',
    });
  });

  test('tolerates whitespace around tokens', () => {
    expect(SUL.parseShortcut('  accel ,  K  ')).toEqual({
      accel: true, alt: false, shift: false, key: 'K',
    });
  });
});

describe('matchShortcut on Windows', () => {
  beforeAll(() => { Zotero.isMac = false; });

  test('matches when ctrlKey acts as accel', () => {
    const parsed = { accel: true, alt: false, shift: false, key: 'K' };
    const event = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'k' };
    expect(SUL.matchShortcut(parsed, event)).toBe(true);
  });

  test('does not match when accel modifier is missing', () => {
    const parsed = { accel: true, alt: false, shift: false, key: 'K' };
    const event = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, key: 'k' };
    expect(SUL.matchShortcut(parsed, event)).toBe(false);
  });

  test('does not match when extra modifier is held', () => {
    const parsed = { accel: true, alt: false, shift: false, key: 'K' };
    const event = { ctrlKey: true, metaKey: false, altKey: true, shiftKey: false, key: 'k' };
    expect(SUL.matchShortcut(parsed, event)).toBe(false);
  });

  test('matches case-insensitively on key', () => {
    const parsed = { accel: false, alt: false, shift: false, key: 'A' };
    expect(SUL.matchShortcut(parsed, { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, key: 'a' })).toBe(true);
    expect(SUL.matchShortcut(parsed, { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, key: 'A' })).toBe(true);
  });

  test('metaKey alone is ignored on non-Mac', () => {
    const parsed = { accel: true, alt: false, shift: false, key: 'K' };
    const event = { ctrlKey: false, metaKey: true, altKey: false, shiftKey: false, key: 'k' };
    expect(SUL.matchShortcut(parsed, event)).toBe(false);
  });
});

describe('matchShortcut on Mac', () => {
  beforeAll(() => { Zotero.isMac = true; });
  afterAll(() => { Zotero.isMac = false; });

  test('uses metaKey for accel', () => {
    const parsed = { accel: true, alt: false, shift: false, key: 'K' };
    const event = { ctrlKey: false, metaKey: true, altKey: false, shiftKey: false, key: 'k' };
    expect(SUL.matchShortcut(parsed, event)).toBe(true);
  });

  test('ctrlKey alone is ignored on Mac', () => {
    const parsed = { accel: true, alt: false, shift: false, key: 'K' };
    const event = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'k' };
    expect(SUL.matchShortcut(parsed, event)).toBe(false);
  });
});
