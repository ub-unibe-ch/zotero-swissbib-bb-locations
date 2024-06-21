const { JSDOM } = require('jsdom');

beforeEach(() => {
  jest.resetModules();
});

global.Zotero = {
  Prefs: {
    get: (pref, skipFallback) => {
      const prefs = {
        'extensions.sul.sruurl': 'http://example.com/sru',
        'extensions.sul.apikey': 'fake-api-key',
        'extensions.sul.targetField': 'notes'
      };
      return prefs[pref];
    }
  },
  debug: console.log,
  ItemTypes: {
    getID: (type) => type === 'book' ? 1 : 0
  },
  getActiveZoteroPane: () => ({
    getSelectedItems: () => [
      { itemTypeID: 1, getField: (field) => field === 'ISBN' ? '9781234567897' : '' },
      { itemTypeID: 1, getField: (field) => field === 'ISBN' ? '9789876543210' : '' }
    ]
  })
};

describe('SUL Plugin - Process Multiple Items', () => {
  let SUL;

  beforeEach(() => {
    SUL = require('../src/swisscoveryubbernlocations');
    SUL.initialized = false;
    jest.clearAllMocks();
  });

  const createMockItem = (isbn) => ({
    getField: jest.fn().mockReturnValue(isbn),
    setField: jest.fn(),
    getTags: jest.fn().mockReturnValue([]),
    saveTx: jest.fn(),
    addTag: jest.fn(),
    removeTag: jest.fn(),
    hasTag: jest.fn().mockReturnValue(false)
  });

  const createXMLString = (records) => `
    <searchRetrieveResponse>
      <numberOfRecords>${records.length}</numberOfRecords>
      ${records.map(record => `
        <datafield tag="AVE">
          ${record.eholdingAvailability ? `<subfield code="e">${record.eholdingAvailability}</subfield>` : ''}
          ${record.eholdingZonesString ? `<subfield code="b">${record.eholdingZonesString}</subfield>` : ''}
          ${record.eholdingPackage ? `<subfield code="m">${record.eholdingPackage}</subfield>` : ''}
        </datafield>
        <datafield tag="AVA">
          ${record.holdingLibraryCode ? `<subfield code="b">${record.holdingLibraryCode}</subfield>` : ''}
          ${record.holdingLibrary ? `<subfield code="q">${record.holdingLibrary}</subfield>` : ''}
          ${record.holdingLibraryViaRapido ? `<subfield code="j">${record.holdingLibraryViaRapido}</subfield>` : ''}
          ${record.holdingLibraryLocation ? `<subfield code="c">${record.holdingLibraryLocation}</subfield>` : ''}
          ${record.holdingBibRecordID ? `<subfield code="0">${record.holdingBibRecordID}</subfield>` : ''}
          ${record.holdingHoldingsID ? `<subfield code="8">${record.holdingHoldingsID}</subfield>` : ''}
        </datafield>
      `).join('')}
    </searchRetrieveResponse>
  `;

  it('should process multiple items with various holdings', async () => {
    const items = [
      createMockItem('9781234567897'),
      createMockItem('9789876543217')
    ];

    const xmlStrings = [
      createXMLString([
        {
          eholdingAvailability: "Available",
          eholdingZonesString: "41SLSP_UBE_UNI",
          eholdingPackage: "EBA Package TEMP",
        },
      ]),
      createXMLString([
        {
          holdingLibraryCode: "B410",
          holdingLibrary: "Bern UB Unitobler",
          holdingLibraryLocation: "Evang. Theologie Freihandbestand",
          holdingBibRecordID: "12345",
          holdingHoldingsID: "67890",
        },
      ]),
    ];

    const dom = new JSDOM();
    const parser = new dom.window.DOMParser();

    const mockResponseXMLs = xmlStrings.map(xmlString => parser.parseFromString(xmlString, 'application/xml'));

    SUL.locationLookup.fetchXML = jest.fn()
      .mockResolvedValueOnce({ responseXML: mockResponseXMLs[0] })
      .mockResolvedValueOnce({ responseXML: mockResponseXMLs[1] });

    for (const item of items) {
      await SUL.locationLookup.processItem(item);
    }

    expect(items[0].addTag).toHaveBeenCalledWith(SUL.tags.inUBBeOnlineViaEBA);
    expect(items[0].addTag).toHaveBeenCalledWith(SUL.tags.notInUBBE);
    expect(items[0].setField).toHaveBeenCalled();
    expect(items[0].saveTx).toHaveBeenCalled();

    expect(items[1].addTag).toHaveBeenCalledWith(SUL.tags.inUBBe);
    expect(items[1].addTag).toHaveBeenCalledWith(SUL.tags.inUBBeKurierbib);
    expect(items[1].setField).toHaveBeenCalled();
    expect(items[1].saveTx).toHaveBeenCalled();
  });
});
