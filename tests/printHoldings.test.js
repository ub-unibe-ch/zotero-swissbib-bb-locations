const { JSDOM } = require('jsdom');

beforeEach(() => {
  jest.resetModules();
});

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

describe('SUL Plugin - Print Holdings', () => {
  let SUL;

  beforeEach(() => {
    SUL = require('../src/swisscoveryubbernlocations');
    SUL.initialized = false;
    jest.clearAllMocks();
  });

  describe('processPrintHoldings', () => {
    test('should update itemStatus for print holdings correctly', async () => {
      const xmlString = `
        <record>
          <datafield tag="AVA">
            <subfield code="b">B400</subfield>
            <subfield code="q">Bern UB Speichermagazin</subfield>
            <subfield code="c">Sektor K5</subfield>
            <subfield code="0">12345</subfield>
            <subfield code="8">67890</subfield>
          </datafield>
        </record>
      `;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

      SUL.locationLookup.getItemPolicy = jest.fn().mockResolvedValue('01 Loan 28 days');

      const result = await SUL.locationLookup.processPrintHoldings(mockResponseXML);
      expect(result).toEqual({
        formattedResult: 'Bern UB Speichermagazin, Sektor K5, 01 Loan 28 days',
        itemStatus: {
          isInUBBe: true,
          isInUBBeOnline: false,
          isInUBBeOnlineViaEBA: false,
          isInUBBeKurierbib: true,
          isWithoutISBN: false,
        }
      });
    });

    test('should handle multiple print holdings correctly', async () => {
      const xmlString = `
        <record>
        <datafield tag="AVA">
        <subfield code="b">B400</subfield>
        <subfield code="q">Bern UB Speichermagazin</subfield>
        <subfield code="c">Sektor K5</subfield>
        <subfield code="0">12345</subfield>
        <subfield code="8">67890</subfield>
      </datafield>
          <datafield tag="AVA">
            <subfield code="b">B410</subfield>
            <subfield code="q">Bern UB Unitobler</subfield>
            <subfield code="c">Evang. Theologie Freihandbestand</subfield>
            <subfield code="0">12346</subfield>
            <subfield code="8">67891</subfield>
          </datafield>
        </record>
      `;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

      SUL.locationLookup.getItemPolicy = jest.fn()
        .mockResolvedValueOnce('01 Loan 28 days')
        .mockResolvedValueOnce('nicht verfügbar');

      const result = await SUL.locationLookup.processPrintHoldings(mockResponseXML);
      expect(result).toEqual({
        formattedResult: 'Bern UB Speichermagazin, Sektor K5, 01 Loan 28 days\nBern UB Unitobler, Evang. Theologie Freihandbestand, nicht verfügbar',
        itemStatus: {
          isInUBBe: true,
          isInUBBeOnline: false,
          isInUBBeOnlineViaEBA: false,
          isInUBBeKurierbib: true,
          isWithoutISBN: false,
        }
      });
    });

    test('should handle no print holdings', async () => {
      const xmlString = `<record></record>`;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

      const result = await SUL.locationLookup.processPrintHoldings(mockResponseXML);
      expect(result).toEqual({
        formattedResult: 'Keine Printbestände vorhanden',
        itemStatus: {
          isInUBBe: false,
          isInUBBeOnline: false,
          isInUBBeOnlineViaEBA: false,
          isInUBBeKurierbib: false,
          isWithoutISBN: false,
        }
      });
    });


    test('should handle rapido loans', async () => {
      const xmlString = `
      <record>
        <datafield tag="AVA">
          <subfield code="b">B410</subfield>
          <subfield code="q">Bern UB Unitobler</subfield>
          <subfield code="c">Borrowing Location</subfield>
          <subfield code="j">RS_BORROW</subfield>
          <subfield code="0">12345</subfield>
          <subfield code="8">67890</subfield>
        </datafield>
      </record>
    `;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

      const result = await SUL.locationLookup.processPrintHoldings(mockResponseXML);
      expect(result).toEqual({
        formattedResult: 'Bern UB Unitobler, Borrowing Location (via Rapido)',
        itemStatus: {
          isInUBBe: false,
          isInUBBeOnline: false,
          isInUBBeOnlineViaEBA: false,
          isInUBBeKurierbib: false,
          isWithoutISBN: false,
        }
      });
    });

  });

  describe('getPrintHoldingsData', () => {
    test('should return print holdings data', async () => {
      const xmlString = `
        <record>
          <datafield tag="AVA">
            <subfield code="b">B410</subfield>
            <subfield code="q">Bern UB Unitobler</subfield>
            <subfield code="c">Freihandbestand</subfield>
            <subfield code="0">12345</subfield>
            <subfield code="8">67890</subfield>
          </datafield>
        </record>
      `;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

      SUL.locationLookup.getItemPolicy = jest.fn().mockResolvedValue('01 Loan 28 days');

      const result = await SUL.locationLookup.getPrintHoldingsData(mockResponseXML);
      expect(result).toEqual([{
        holdingLibraryCode: 'B410',
        holdingLibrary: 'Bern UB Unitobler',
        holdingLibraryViaRapido: false,
        holdingLibraryLocation: 'Freihandbestand',
        holdingItemPolicy: '01 Loan 28 days',
        holdingHoldingsID: '67890',
        holdingBibRecordID: '12345'
      }]);
    });

    test('should return empty array if no print holdings data', async () => {
      const xmlString = `<record></record>`;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

      const result = await SUL.locationLookup.getPrintHoldingsData(mockResponseXML);
      expect(result).toEqual([]);
    });
  });

  describe('getPrintHoldingData', () => {
    test('should return print holding data for rapido loan', async () => {
      const xmlString = `
        <datafield tag="AVA">
          <subfield code="b">B410</subfield>
          <subfield code="q">Bern UB Unitobler</subfield>
          <subfield code="j">RS_BORROW</subfield>
          <subfield code="c">Borrowing Location</subfield>
          <subfield code="0">12345</subfield>
          <subfield code="8">67890</subfield>
        </datafield>
      `;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockHolding = parser.parseFromString(xmlString, 'application/xml');

      const result = await SUL.locationLookup.getPrintHoldingData(mockHolding);
      expect(result).toEqual({
        holdingLibraryCode: 'B410',
        holdingLibrary: 'Bern UB Unitobler',
        holdingLibraryViaRapido: true,
        holdingLibraryLocation: 'Borrowing Location (via Rapido)',
        holdingItemPolicy: '',
        holdingHoldingsID: '67890',
        holdingBibRecordID: '12345'
      });
    });

    test('should return default values if subfields are missing', async () => {
      const xmlString = `<datafield tag="AVA"></datafield>`;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockHolding = parser.parseFromString(xmlString, 'application/xml');

      SUL.locationLookup.getItemPolicy = jest.fn().mockResolvedValue('');

      const result = await SUL.locationLookup.getPrintHoldingData(mockHolding);
      expect(result).toEqual({
        holdingLibraryCode: '',
        holdingLibrary: '',
        holdingLibraryViaRapido: false,
        holdingLibraryLocation: '',
        holdingItemPolicy: '',
        holdingHoldingsID: '',
        holdingBibRecordID: ''
      });
    });
  });

  describe('formatPrintHolding', () => {
    test('should format print holding correctly', () => {
      const holding = {
        holdingLibrary: 'Bern UB Unitobler',
        holdingLibraryLocation: 'Evang. Theologie Freihandbestand',
        holdingItemPolicy: 'Leihbedingungen'
      };

      const result = SUL.locationLookup.formatPrintHolding(holding);
      expect(result).toBe('Bern UB Unitobler, Evang. Theologie Freihandbestand, Leihbedingungen');
    });

    test('should format print holding without item policy correctly', () => {
      const holding = {
        holdingLibrary: 'Bern UB Unitobler',
        holdingLibraryLocation: 'Evang. Theologie Freihandbestand',
        holdingItemPolicy: ''
      };

      const result = SUL.locationLookup.formatPrintHolding(holding);
      expect(result).toBe('Bern UB Unitobler, Evang. Theologie Freihandbestand');
    });

    test('should format print holding without location and policy correctly', () => {
      const holding = {
        holdingLibrary: 'Bern UB Unitobler',
        holdingLibraryLocation: '',
        holdingItemPolicy: ''
      };

      const result = SUL.locationLookup.formatPrintHolding(holding);
      expect(result).toBe('Bern UB Unitobler');
    });
  });

  describe('contentForTargetField', () => {
    test('should prepend new content to the existing content', () => {
      const mockItem = {
        getField: jest.fn().mockReturnValue('Existing content')
      };

      const result = SUL.locationLookup.contentForTargetField(mockItem, 'notes', 'New content');
      expect(result).toBe('New content\n============================\n\nExisting content');
    });

    test('should prepend new content to an empty existing content', () => {
      const mockItem = {
        getField: jest.fn().mockReturnValue('')
      };

      const result = SUL.locationLookup.contentForTargetField(mockItem, 'notes', 'New content');
      expect(result).toBe('New content\n============================\n\n');
    });
  });
});
