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


const { JSDOM } = require('jsdom');
const SUL = require('../src/swisscoveryubbernlocations');


describe('SUL Plugin - Electronic Holdings', () => {
  beforeEach(() => {
    SUL.initialized = false;
    jest.clearAllMocks();
  });

  describe('processElectronicHoldings', () => {

    test('should process record without electronic holdings', () => {
      const xmlString = `<record></record>`;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

      const result = SUL.locationLookup.processElectronicHoldings(mockResponseXML);
      expect(result).toEqual({
        formattedResult: 'Keine elektronischen Bestände vorhanden',
        itemStatus: {
          isInUBBe: false,
          isInUBBeOnline: false,
          isInUBBeOnlineViaEBA: false,
          isInUBBeKurierbib: false,
          isWithoutISBN: false,
        }
      });
    });

    test('should process electronic holdings data with all subfields present and valid (single zone)', () => {
      const xmlString = `
        <record>
          <datafield tag="AVE">
            <subfield code="e">Available</subfield>
            <subfield code="b">41SLSP_UBE_UNI</subfield>
            <subfield code="m">Oxford Handbooks Online Religion</subfield>
          </datafield>
        </record>
      `;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

      const result = SUL.locationLookup.processElectronicHoldings(mockResponseXML);
      expect(result).toEqual({
        formattedResult: 'Online verfügbar, verfügbar für Uni, Oxford Handbooks Online Religion',
        itemStatus: {
          isInUBBe: true,
          isInUBBeOnline: true,
          isInUBBeOnlineViaEBA: false,
          isInUBBeKurierbib: false,
          isWithoutISBN: false,
        }
      });
    });

    test('should process electronic holdings data with all subfields present and valid (multiple zones)', () => {
      const xmlString = `
        <record>
          <datafield tag="AVE">
            <subfield code="e">Available</subfield>
            <subfield code="b">41SLSP_UBE_UNI</subfield>
            <subfield code="b">41SLSP_UBE_PH</subfield>
            <subfield code="m">Oxford Handbooks Online Complete</subfield>
          </datafield>
        </record>
      `;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

      const result = SUL.locationLookup.processElectronicHoldings(mockResponseXML);
      expect(result).toEqual({
        formattedResult: 'Online verfügbar, verfügbar für Uni und PH, Oxford Handbooks Online Complete',
        itemStatus: {
          isInUBBe: true,
          isInUBBeOnline: true,
          isInUBBeOnlineViaEBA: false,
          isInUBBeKurierbib: false,
          isWithoutISBN: false,
        }
      });
    });

    test('should handle missing subfields gracefully', () => {
      const xmlString = `
        <record>
          <datafield tag="AVE">
            <subfield code="e">Available</subfield>
          </datafield>
        </record>
      `;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

      const result = SUL.locationLookup.processElectronicHoldings(mockResponseXML);
      expect(result).toEqual({
        formattedResult: 'Online verfügbar, ohne Infos zu Verfügbarkeiten, ohne Paketinfos',
        itemStatus: {
          isInUBBe: true,
          isInUBBeOnline: true,
          isInUBBeOnlineViaEBA: false,
          isInUBBeKurierbib: false,
          isWithoutISBN: false,
        }
      });
    });

    test('should return default message when no electronic holdings are available', () => {
      const xmlString = `
        <record></record>
      `;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

      const result = SUL.locationLookup.processElectronicHoldings(mockResponseXML);
      expect(result).toEqual({
        formattedResult: 'Keine elektronischen Bestände vorhanden',
        itemStatus: {
          isInUBBe: false,
          isInUBBeOnline: false,
          isInUBBeOnlineViaEBA: false,
          isInUBBeKurierbib: false,
          isWithoutISBN: false,
        }
      });
    });

    test('should process electronic holdings with TEMP package correctly', () => {
      const xmlString = `
        <record>
          <datafield tag="AVE">
            <subfield code="e">Available</subfield>
            <subfield code="b">41SLSP_UBE_UNI</subfield>
            <subfield code="m">Springer EBA TEMP</subfield>
          </datafield>
        </record>
      `;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

      const result = SUL.locationLookup.processElectronicHoldings(mockResponseXML);
      expect(result).toEqual({
        formattedResult: 'Online verfügbar, verfügbar für Uni, Springer EBA TEMP',
        itemStatus: {
          isInUBBe: false,
          isInUBBeOnline: false,
          isInUBBeOnlineViaEBA: true,
          isInUBBeKurierbib: false,
          isWithoutISBN: false,
        }
      });
    });

    test('should process multiple electronic holdings correctly', () => {
      const xmlString = `
        <record>
          <datafield tag="AVE">
            <subfield code="e">Available</subfield>
            <subfield code="b">41SLSP_UBE_UNI</subfield>
            <subfield code="m">Example Package</subfield>
          </datafield>
          <datafield tag="AVE">
            <subfield code="e">Available</subfield>
            <subfield code="b">41SLSP_UBE_UNI</subfield>
            <subfield code="m">Example Package TEMP</subfield>
          </datafield>
        </record>
      `;
      const dom = new JSDOM();
      const parser = new dom.window.DOMParser();
      const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

      const result = SUL.locationLookup.processElectronicHoldings(mockResponseXML);
      expect(result).toEqual({
        formattedResult: 'Online verfügbar, verfügbar für Uni, Example Package\nOnline verfügbar, verfügbar für Uni, Example Package TEMP',
        itemStatus: {
          isInUBBe: true,
          isInUBBeOnline: true,
          isInUBBeOnlineViaEBA: false,
          isInUBBeKurierbib: false,
          isWithoutISBN: false,
        }
      });
    });
  });
});
