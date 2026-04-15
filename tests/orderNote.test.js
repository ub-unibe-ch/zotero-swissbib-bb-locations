global.Zotero = {
    Prefs: {
      get: (pref, skipFallback) => {
        const prefs = {
          "extensions.swisscoveryubbernlocations.sruurl": "http://example.com/sru",
          "extensions.swisscoveryubbernlocations.apikey": "fake-api-key",
          "extensions.swisscoveryubbernlocations.targetField": "notes",
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

  });

  describe('addOrderNote - missing tag validation and debug mode', () => {
    let mockItem;
    let savedPrefsGet;

    beforeEach(() => {
      savedPrefsGet = Zotero.Prefs.get;

      const prefs = {
        "extensions.swisscoveryubbernlocations.debug": false,
      };
      Zotero.Prefs.get = (pref) => prefs[pref];

      mockItem = {
        itemTypeID: 1,
        fields: {},
        _tags: [],
        getField(field) { return this.fields[field] || ''; },
        setField(field, value) { this.fields[field] = value; },
        getTags() { return this._tags; },
        save: jest.fn().mockResolvedValue(undefined),
      };

      Zotero.ItemTypes = { getID: (type) => type === 'book' ? 1 : 0 };
      Zotero.DB = { executeTransaction: async (fn) => await fn() };
      Zotero.getActiveZoteroPane = () => ({
        getSelectedItems: () => [mockItem],
      });

      SUL.initialized = false;
    });

    afterEach(() => {
      Zotero.Prefs.get = savedPrefsGet;
    });

    test('should set warning when ETAT tag is missing', async () => {
      mockItem._tags = [
        { tag: 'DDC 230' },
        { tag: 'BC MEX' },
      ];
      await SUL.orderNote.addOrderNote();
      expect(mockItem.fields.volume).toBe('⚠ FEHLT: ETAT');
    });

    test('should set warning when DDC tag is missing', async () => {
      mockItem._tags = [
        { tag: 'BC MEX' },
        { tag: 'ETAT 20' },
      ];
      await SUL.orderNote.addOrderNote();
      expect(mockItem.fields.volume).toBe('⚠ FEHLT: DDC');
    });

    test('should set warning when both ETAT and DDC are missing', async () => {
      mockItem._tags = [
        { tag: 'BC MEX' },
      ];
      await SUL.orderNote.addOrderNote();
      expect(mockItem.fields.volume).toBe('⚠ FEHLT: ETAT, DDC');
    });

    test('should append timestamp in debug mode', async () => {
      Zotero.Prefs.get = (pref) => ({
        "extensions.swisscoveryubbernlocations.debug": true,
      })[pref];

      mockItem._tags = [
        { tag: 'DDC 230' },
        { tag: 'BC MEX' },
        { tag: 'ETAT 20' },
      ];
      await SUL.orderNote.addOrderNote();
      expect(mockItem.fields.volume).toMatch(/^20 \/\/ 230 \/\/ MEX \[.+\]$/);
    });

    test('should not append timestamp when debug is off', async () => {
      mockItem._tags = [
        { tag: 'DDC 230' },
        { tag: 'BC MEX' },
        { tag: 'ETAT 20' },
      ];
      await SUL.orderNote.addOrderNote();
      expect(mockItem.fields.volume).toBe('20 // 230 // MEX');
    });
  });
  