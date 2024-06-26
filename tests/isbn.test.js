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
  
  describe('SUL Plugin - ISBN Functions', () => {
    beforeEach(() => {
      SUL.initialized = false;
    });
  
    describe('isValidIsbn', () => {
      test('should validate valid ISBN-13', () => {
        const validISBN13 = '9781234567897';
        const result = SUL.helpers.isValidIsbn(validISBN13);
        expect(result).toBe(true);
      });
  
      test('should invalidate invalid ISBN-13', () => {
        const invalidISBN13 = '9781234567890';
        const result = SUL.helpers.isValidIsbn(invalidISBN13);
        expect(result).toBe(false);
      });
  
      test('should validate valid ISBN-10', () => {
        const validISBN10 = '123456789X';
        const result = SUL.helpers.isValidIsbn(validISBN10);
        expect(result).toBe(true);
      });
  
      test('should invalidate invalid ISBN-10', () => {
        const invalidISBN10 = '1234567890';
        const result = SUL.helpers.isValidIsbn(invalidISBN10);
        expect(result).toBe(false);
      });
    });
  
    describe('getIsbns', () => {
      test('should extract ISBNs from an item', () => {
        const item = {
          getField: (field) => field === 'ISBN' ? '9781234567897 123456789X' : ''
        };
        const result = SUL.locationLookup.getIsbns(item);
        expect(result).toEqual(['9781234567897', '123456789X']);
      });
  
      test('should return an empty array if no ISBNs are present', () => {
        const item = {
          getField: (field) => ''
        };
        const result = SUL.locationLookup.getIsbns(item);
        expect(result).toEqual([]);
      });
    });
  });
  