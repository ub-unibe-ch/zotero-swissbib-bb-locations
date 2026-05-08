global.Zotero = {
  Prefs: { get: () => undefined },
  debug: () => {},
  isMac: false,
};

const SUL = require('../src/swisscoveryubbernlocations');

describe('parseShortcut', () => {
  test('parses accel,alt,K', () => {
    expect(SUL.parseShortcut('accel,alt,K')).toEqual({
      accel: true, ctrl: false, meta: false, alt: true, shift: false, key: 'K',
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
      accel: true, ctrl: false, meta: false, alt: false, shift: true, key: 'K',
    });
  });

  test('tolerates whitespace around tokens', () => {
    expect(SUL.parseShortcut('  accel ,  K  ')).toEqual({
      accel: true, ctrl: false, meta: false, alt: false, shift: false, key: 'K',
    });
  });

  test('parses literal control modifier (XUL canonical and ctrl alias)', () => {
    expect(SUL.parseShortcut('control,K')).toEqual({
      accel: false, ctrl: true, meta: false, alt: false, shift: false, key: 'K',
    });
    expect(SUL.parseShortcut('ctrl,K')).toEqual({
      accel: false, ctrl: true, meta: false, alt: false, shift: false, key: 'K',
    });
  });

  test('parses literal meta modifier (XUL canonical and cmd alias)', () => {
    expect(SUL.parseShortcut('meta,K')).toEqual({
      accel: false, ctrl: false, meta: true, alt: false, shift: false, key: 'K',
    });
    expect(SUL.parseShortcut('cmd,K')).toEqual({
      accel: false, ctrl: false, meta: true, alt: false, shift: false, key: 'K',
    });
  });

  test('rejects accel combined with literal control or meta', () => {
    expect(SUL.parseShortcut('accel,ctrl,K')).toBeNull();
    expect(SUL.parseShortcut('accel,meta,K')).toBeNull();
    expect(SUL.parseShortcut('accel,control,cmd,K')).toBeNull();
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

  test('accel+key with extra ctrl held does not match (extra modifier guard)', () => {
    const parsed = SUL.parseShortcut('accel,K');
    const event = { ctrlKey: true, metaKey: true, altKey: false, shiftKey: false, key: 'k' };
    expect(SUL.matchShortcut(parsed, event)).toBe(false);
  });

  test('literal ctrl shortcut works on Mac (lets Mac users bind Ctrl+key)', () => {
    const parsed = SUL.parseShortcut('ctrl,K');
    const macCtrlEvent = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'k' };
    expect(SUL.matchShortcut(parsed, macCtrlEvent)).toBe(true);
    const macCmdEvent = { ctrlKey: false, metaKey: true, altKey: false, shiftKey: false, key: 'k' };
    expect(SUL.matchShortcut(parsed, macCmdEvent)).toBe(false);
  });
});

describe('matchShortcut with literal modifiers on Windows', () => {
  beforeAll(() => { Zotero.isMac = false; });

  test('literal meta (Win key) does not match plain Ctrl press', () => {
    const parsed = SUL.parseShortcut('meta,K');
    const winCtrl = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: 'k' };
    expect(SUL.matchShortcut(parsed, winCtrl)).toBe(false);
    const winMeta = { ctrlKey: false, metaKey: true, altKey: false, shiftKey: false, key: 'k' };
    expect(SUL.matchShortcut(parsed, winMeta)).toBe(true);
  });
});
