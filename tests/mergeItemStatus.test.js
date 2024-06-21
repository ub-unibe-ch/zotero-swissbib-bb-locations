global.Zotero = {
    Prefs: {
      get: (pref, skipFallback) => {
        const prefs = {
          "extensions.sul.sruurl": "http://example.com/sru",
          "extensions.sul.apikey": "fake-api-key",
          "extensions.sul.targetField": "notes",
        };
        return prefs[pref];
      },
    },
    debug: console.log,
  };
  const SUL = require('../src/swisscoveryubbernlocations');
  
  describe('SUL Plugin - Merge Item Status', () => {
    beforeEach(() => {
      SUL.initialized = false;
    });
  
    test('should correctly merge two item statuses where one has all false values', () => {
      const status1 = {
        isInUBBe: false,
        isInUBBeOnline: false,
        isInUBBeOnlineViaEBA: false,
        isinUBBeKurierbib: false,
        isWithoutISBN: false,
      };
      const status2 = {
        isInUBBe: true,
        isInUBBeOnline: true,
        isInUBBeOnlineViaEBA: true,
        isinUBBeKurierbib: true,
        isWithoutISBN: true,
      };
      const result = SUL.locationLookup.mergeItemStatus(status1, status2);
      expect(result).toEqual(status2);
    });
  
    test('should correctly merge two item statuses with mixed true and false values', () => {
      const status1 = {
        isInUBBe: true,
        isInUBBeOnline: false,
        isInUBBeOnlineViaEBA: false,
        isinUBBeKurierbib: true,
        isWithoutISBN: false,
      };
      const status2 = {
        isInUBBe: false,
        isInUBBeOnline: false,
        isInUBBeOnlineViaEBA: true,
        isinUBBeKurierbib: false,
        isWithoutISBN: false,
      };
      const expectedResult = {
        isInUBBe: true,
        isInUBBeOnline: false,
        isInUBBeOnlineViaEBA: true,
        isinUBBeKurierbib: true,
        isWithoutISBN: false,
      };
      const result = SUL.locationLookup.mergeItemStatus(status1, status2);
      expect(result).toEqual(expectedResult);
    });
  });
  