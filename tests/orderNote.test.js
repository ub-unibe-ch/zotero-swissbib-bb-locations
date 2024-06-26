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
  
  describe('SUL Plugin - Order Note Functions', () => {
    beforeEach(() => {
      SUL.initialized = false;
    });
  
    test('should construct a simple order note correctly', () => {
      const tags = [
        { tag: 'DDC 230' },
        { tag: 'BC MEX' },
        { tag: 'ETAT 20' }
      ];
      const { ddcs, orderCodes, budgetCode } = SUL.orderNote.extractTags(tags);
      const result = SUL.orderNote.constructOrderNote({ ddcs, orderCodes, budgetCode });
      expect(result).toBe('20 // 230 // MEX');
    });

    test('should construct an order note without order codes correctly', () => {
      const tags = [
        { tag: 'DDC 230' },
        { tag: 'ETAT 20' }
      ];
      const { ddcs, orderCodes, budgetCode } = SUL.orderNote.extractTags(tags);
      const result = SUL.orderNote.constructOrderNote({ ddcs, orderCodes, budgetCode });
      expect(result).toBe('20 // 230');
    });

    test('should construct an order with multiple DDCs', () => {
      const tags = [
        { tag: 'DDC 200' },
        { tag: 'DDC 230' },
        { tag: 'DDC 290' },
        { tag: 'BC MEX' },
        { tag: 'ETAT 20' }
      ];
      const { ddcs, orderCodes, budgetCode } = SUL.orderNote.extractTags(tags);
      const result = SUL.orderNote.constructOrderNote({ ddcs, orderCodes, budgetCode });
      expect(result).toBe('20 // 200, 230, 290 // MEX');
    });

    test.skip('should flag order notes with missing ETAT info', () => {
      // not yet implemented
      const tags = [
        { tag: 'DDC 230' },
        { tag: 'BC MEX' }
      ];
      const { ddcs, orderCodes, budgetCode } = SUL.orderNote.extractTags(tags);
      const result = SUL.orderNote.constructOrderNote({ ddcs, orderCodes, budgetCode });
      expect(result).toBe('!!! FEHLENDER ETAT !!!');
    });


  });
  