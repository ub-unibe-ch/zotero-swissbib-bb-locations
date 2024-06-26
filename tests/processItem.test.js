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
      { itemTypeID: 1, getField: (field) => field === 'ISBN' ? '9781234567897' : '' }
    ]
  })
};

describe('SUL Plugin - Process Item', () => {
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

  it('should process item with valid ISBN and set correct status for electronic item via EBA', async () => {
    const mockItem = createMockItem('9781234567897');

    const xmlString = `
      <searchRetrieveResponse>
        <numberOfRecords>1</numberOfRecords>
        <datafield tag="AVE">
          <subfield code="e">Available</subfield>
          <subfield code="b">41SLSP_UBE_UNI</subfield>
          <subfield code="b">41SLSP_UBE_PH</subfield>
          <subfield code="m">TEMP Package</subfield>
        </datafield>
      </searchRetrieveResponse>
    `;
    const dom = new JSDOM();
    const parser = new dom.window.DOMParser();
    const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

    SUL.locationLookup.fetchXML = jest.fn().mockResolvedValue({ responseXML: mockResponseXML });

    await SUL.locationLookup.processItem(mockItem);

    expect(mockItem.addTag).toHaveBeenCalledWith(SUL.tags.inUBBeOnlineViaEBA);
    expect(mockItem.addTag).toHaveBeenCalledWith(SUL.tags.notInUBBE);
    expect(mockItem.setField).toHaveBeenCalled();
    expect(mockItem.saveTx).toHaveBeenCalled();
  });

  it('should process item with valid ISBN and set correct status for electronic holdings', async () => {
    const mockItem = createMockItem('9781234567897');

    const xmlString = `
      <searchRetrieveResponse>
        <numberOfRecords>1</numberOfRecords>
        <datafield tag="AVE">
          <subfield code="e">Available</subfield>
          <subfield code="b">41SLSP_UBE_UNI</subfield>
          <subfield code="b">41SLSP_UBE_PH</subfield>
          <subfield code="m">Package</subfield>
        </datafield>
      </searchRetrieveResponse>
    `;
    const dom = new JSDOM();
    const parser = new dom.window.DOMParser();
    const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

    SUL.locationLookup.fetchXML = jest.fn().mockResolvedValue({ responseXML: mockResponseXML });

    await SUL.locationLookup.processItem(mockItem);

    expect(mockItem.addTag).toHaveBeenCalledWith(SUL.tags.inUBBeOnline);
    expect(mockItem.addTag).toHaveBeenCalledWith(SUL.tags.inUBBe);
    expect(mockItem.setField).toHaveBeenCalled();
    expect(mockItem.saveTx).toHaveBeenCalled();
  });

  it('should process item with valid ISBN and set correct status for print holdings', async () => {
    const mockItem = createMockItem('9781234567897');

    const xmlString = `
      <searchRetrieveResponse>
        <numberOfRecords>1</numberOfRecords>
        <datafield tag="AVA">
          <subfield code="b">B400</subfield>
          <subfield code="q">Bern UB Speichermagazin</subfield>
          <subfield code="c">Location</subfield>
          <subfield code="0">12345</subfield>
          <subfield code="8">67890</subfield>
        </datafield>
      </searchRetrieveResponse>
    `;
    const dom = new JSDOM();
    const parser = new dom.window.DOMParser();
    const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

    SUL.locationLookup.fetchXML = jest.fn().mockResolvedValue({ responseXML: mockResponseXML });

    await SUL.locationLookup.processItem(mockItem);

    expect(mockItem.addTag).toHaveBeenCalledWith(SUL.tags.inUBBe);
    expect(mockItem.addTag).toHaveBeenCalledWith(SUL.tags.inUBBeKurierbib);
    expect(mockItem.setField).toHaveBeenCalled();
    expect(mockItem.saveTx).toHaveBeenCalled();
  });

  it('should process item with valid ISBN and set correct status for print holdings (not in Kurierbib)', async () => {
    const mockItem = createMockItem('9781234567897');

    const xmlString = `
      <searchRetrieveResponse>
        <numberOfRecords>1</numberOfRecords>
        <datafield tag="AVA">
          <subfield code="b">B554</subfield>
          <subfield code="q">Bern UB Muesmatt</subfield>
          <subfield code="c">Location</subfield>
          <subfield code="0">12345</subfield>
          <subfield code="8">67890</subfield>
        </datafield>
      </searchRetrieveResponse>
    `;
    const dom = new JSDOM();
    const parser = new dom.window.DOMParser();
    const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

    SUL.locationLookup.fetchXML = jest.fn().mockResolvedValue({ responseXML: mockResponseXML });

    await SUL.locationLookup.processItem(mockItem);

    expect(mockItem.addTag).toHaveBeenCalledWith(SUL.tags.inUBBe);
    expect(mockItem.addTag).not.toHaveBeenCalledWith(SUL.tags.inUBBeKurierbib);
    expect(mockItem.setField).toHaveBeenCalled();
    expect(mockItem.saveTx).toHaveBeenCalled();
  });

  it('should process item with valid ISBN and set correct status for print and electronic holdings', async () => {
    const mockItem = createMockItem('9781234567897');

    const xmlString = `
      <searchRetrieveResponse>
        <numberOfRecords>2</numberOfRecords>
        <datafield tag="AVE">
          <subfield code="e">Available</subfield>
          <subfield code="b">41SLSP_UBE_UNI</subfield>
          <subfield code="m">Package</subfield>
        </datafield>
        <datafield tag="AVA">
          <subfield code="b">B452</subfield>
          <subfield code="q">Bern UB</subfield>
          <subfield code="c">Location 1</subfield>
          <subfield code="0">12345</subfield>
          <subfield code="8">67890</subfield>
        </datafield>
      </searchRetrieveResponse>
    `;
    const dom = new JSDOM();
    const parser = new dom.window.DOMParser();
    const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

    SUL.locationLookup.fetchXML = jest.fn().mockResolvedValue({ responseXML: mockResponseXML });

    await SUL.locationLookup.processItem(mockItem);

    expect(mockItem.addTag).toHaveBeenCalledWith(SUL.tags.inUBBeOnline);
    expect(mockItem.addTag).toHaveBeenCalledWith(SUL.tags.inUBBe);
    expect(mockItem.addTag).toHaveBeenCalledWith(SUL.tags.inUBBeKurierbib);
    expect(mockItem.setField).toHaveBeenCalled();
    expect(mockItem.saveTx).toHaveBeenCalled();
  });

  it('should handle invalid ISBN gracefully', async () => {
    const mockItem = createMockItem('invalidISBN');

    SUL.helpers.isValidIsbn = jest.fn().mockReturnValue(false);

    await SUL.locationLookup.processItem(mockItem);

    expect(mockItem.addTag).toHaveBeenCalledWith(SUL.tags.withoutISBN);
    expect(mockItem.setField).not.toHaveBeenCalled();
    expect(mockItem.saveTx).toHaveBeenCalled();
  });

  it('should process item with valid ISBN and set correct status for multiple electronic holdings', async () => {
    const mockItem = createMockItem('9781234567897');

    const xmlString = `
      <searchRetrieveResponse>
        <numberOfRecords>2</numberOfRecords>
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
      </searchRetrieveResponse>
    `;
    const dom = new JSDOM();
    const parser = new dom.window.DOMParser();
    const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

    SUL.locationLookup.fetchXML = jest.fn().mockResolvedValue({ responseXML: mockResponseXML });

    await SUL.locationLookup.processItem(mockItem);

    expect(mockItem.addTag).toHaveBeenCalledWith(SUL.tags.inUBBe);
    expect(mockItem.setField).toHaveBeenCalled();
    expect(mockItem.saveTx).toHaveBeenCalled();
  });

  it('should process item with valid ISBN and set correct status for multiple print holdings', async () => {
    const mockItem = createMockItem('9781234567897');

    const xmlString = `
      <searchRetrieveResponse>
        <numberOfRecords>2</numberOfRecords>
        <datafield tag="AVA">
          <subfield code="b">B400</subfield>
          <subfield code="q">Bern UB Speichermagazin</subfield>
          <subfield code="c">Location 1</subfield>
          <subfield code="0">12345</subfield>
          <subfield code="8">67890</subfield>
        </datafield>
        <datafield tag="AVA">
          <subfield code="b">B410</subfield>
          <subfield code="q">Bern UB Unitobler</subfield>
          <subfield code="c">Geschichte</subfield>
          <subfield code="0">12346</subfield>
          <subfield code="8">67891</subfield>
        </datafield>
      </searchRetrieveResponse>
    `;
    const dom = new JSDOM();
    const parser = new dom.window.DOMParser();
    const mockResponseXML = parser.parseFromString(xmlString, 'application/xml');

    SUL.locationLookup.fetchXML = jest.fn().mockResolvedValue({ responseXML: mockResponseXML });

    await SUL.locationLookup.processItem(mockItem);

    expect(mockItem.addTag).toHaveBeenCalledWith(SUL.tags.inUBBe);
    expect(mockItem.setField).toHaveBeenCalled();
    expect(mockItem.saveTx).toHaveBeenCalled();
  });
});
