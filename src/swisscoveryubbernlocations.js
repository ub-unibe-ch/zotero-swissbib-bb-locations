SUL = {
  id: null,
  version: null,
  rootURI: null,
  initialized: false,
  addedElementIDs: [],

  init({ id, version, rootURI }) {
    if (this.initialized) return;
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;
  },

  sruPrefix: Zotero.Prefs.get("extensions.sul.sruurl", true),
  apiKey: Zotero.Prefs.get("extensions.sul.apikey", true),
  targetField: Zotero.Prefs.get("extensions.sul.targetField", true),

  kurierbibliothekenUBBe: [
    "B400", "B452", "B465", "B500", "B555", "B404", "B410", "B415", "B410",
  ],

  rapidoCode: "RS_BORROW",

  strings: {
    noResults: "Keine Ergebnisse",
  },

  tags: {
    withoutISBN: "UB Bern Standortcheck: ohne (gültige) ISBN",
    notInUBBE: "UB Bern Standortcheck: nein",
    inUBBe: "UB Bern Standortcheck: ja",
    inUBBeKurierbib: "UB Bern Standortcheck: Kurierbibliothek",
    inUBBeOnline: "UB Bern Standortcheck: Online",
    inUBBeOnlineViaEBA: "UB Bern Standortcheck: Online via EBA",
  },

  log(msg) {
    Zotero.debug("[ Swisscovery UB Bern Locations ] : " + msg);
  },

  addToWindow(window) {
    let doc = window.document;

    // Use Fluent for localization
    window.MozXULElement.insertFTLIfNeeded("ubbernlocations.ftl");

    // Add a submenu to the item menu
    this.submenu = doc.createXULElement("menu");
    this.submenu.id = "SUL_submenu";
    this.submenu.setAttribute("type", "menu");
    this.submenu.setAttribute("class", "menuitem-iconic");
    this.submenu.setAttribute("image", this.rootURI + "glass_48.png");
    this.submenu.setAttribute("data-l10n-id", "sul-itemmenu-submenu");
    doc.getElementById("zotero-itemmenu").appendChild(this.submenu);
    this.storeAddedElement(this.submenu);

    // Add a menu popup
    this.popup = this.submenu.appendChild(doc.createXULElement("menupopup"));
    this.popup.id = "my_popup";
    this.storeAddedElement(this.popup);

    this.createMenuItem(doc, this.popup, {
      id: "submenuitem",
      command: this.locationLookup.LocationLookup.bind(this),
      dataL10nId: "sul-itemmenu-submenu-locationlookup",
    });

    this.createMenuItem(doc, this.popup, {
      id: "submenuitem2",
      command: this.orderNote.addOrderNote.bind(this),
      dataL10nId: "sul-itemmenu-submenu-orderNoteToAbstract",
    });
  },

  createMenuItem(doc, parent, { id, command, dataL10nId }) {
    const menuItem = doc.createXULElement("menuitem");
    menuItem.id = id;
    menuItem.setAttribute("type", "command");
    menuItem.setAttribute("class", "menuitem");
    menuItem.setAttribute("data-l10n-id", dataL10nId);
    menuItem.addEventListener("command", command);
    parent.appendChild(menuItem);
    this.storeAddedElement(menuItem);
  },

  addToAllWindows() {
    const windows = Zotero.getMainWindows();
    for (const win of windows) {
      if (!win.ZoteroPane) continue;
      this.addToWindow(win);
    }
  },

  storeAddedElement(elem) {
    if (!elem.id) {
      throw new Error("Element must have an id");
    }
    this.addedElementIDs.push(elem.id);
  },

  removeFromWindow(window) {
    const doc = window.document;
    for (const id of this.addedElementIDs) {
      doc.getElementById(id)?.remove();
    }
    doc.querySelector('[href="ubbernlocations.ftl"]').remove();
  },

  removeFromAllWindows() {
    const windows = Zotero.getMainWindows();
    for (const win of windows) {
      if (!win.ZoteroPane) continue;
      this.removeFromWindow(win);
    }
  },

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  // ORDER NOTE FUNCTIONS
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////

  orderNote: {
    async addOrderNote() {
      SUL.log("Called addOrderNote from main file");
      const ZoteroPane = Zotero.getActiveZoteroPane();
      const selectedItems = ZoteroPane.getSelectedItems();
      const items = selectedItems.filter(
        (item) => item.itemTypeID === Zotero.ItemTypes.getID("book")
      );
      for (const item of items) {
        const tags = item.getTags();
        const { ddcs, orderCodes, budgetCode } = SUL.orderNote.extractTags(tags);
        const orderNote = SUL.orderNote.constructOrderNote({ ddcs, orderCodes, budgetCode });
        item.setField("volume", orderNote);
        await item.saveTx();
      }
    },

    extractTags(tags) {
      const ddcs = [];
      const orderCodes = [];
      let budgetCode = "";
      tags.forEach((tag) => {
        if (tag.tag.startsWith("DDC")) {
          const tagText = tag.tag.replace(/[^0-9X]/gi, "");
          ddcs.push(tagText);
        } else if (tag.tag.startsWith("BC")) {
          const orderCodeText = tag.tag.substring(3);
          orderCodes.push(orderCodeText);
        } else if (tag.tag.startsWith("ETAT")) {
          budgetCode = tag.tag.substring(5);
        }
      });
      return { ddcs, orderCodes, budgetCode };
    },

    constructOrderNote({ ddcs, orderCodes, budgetCode }) {
      const orderNote = [budgetCode, ddcs.join(", "), orderCodes.join(", ")].filter(Boolean);
      return orderNote.join(" // ");
    },
  },

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  // LOCATION LOOKUP FUNCTIONS
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////

  locationLookup: {
    async LocationLookup() {
      const ZoteroPane = Zotero.getActiveZoteroPane();
      const selectedItems = ZoteroPane.getSelectedItems();
      const itemsToProcess = selectedItems.filter(
        (item) => item.itemTypeID === Zotero.ItemTypes.getID("book")
      );
      for (const item of itemsToProcess) {
        await SUL.locationLookup.processItem(item);
      }
    },

    async processItem(item) {
      const isbns = SUL.locationLookup.getIsbns(item);
      
      if (!isbns.length || !isbns.some(SUL.helpers.isValidIsbn)) {
        const itemStatus = {
          isInUBBe: false,
          isInUBBeOnline: false,
          isInUBBeOnlineViaEBA: false,
          isInUBBeKurierbib: false,
          isWithoutISBN: true,
        };
        SUL.locationLookup.ApplyTags(item, itemStatus);
        await item.saveTx();
      } else {
        try {
          const url = `${SUL.sruPrefix}${isbns.join(" or alma.isbn=")}`;
          SUL.log(`Trying ${url}`);
          const sruResponse = await SUL.locationLookup.fetchXML(url);
          SUL.log(`SRU response: ${sruResponse.responseText}`);
          await SUL.locationLookup.processXML(item, sruResponse);
          await item.saveTx();
        } catch (error) {
          SUL.log(`Error fetching SRU data: ${error.message}`);
        }
      }
    },


    async processXML(item, xml) {
      const { holdingsFormatted, itemStatus } = await SUL.locationLookup.processItemData(xml.responseXML);
      SUL.locationLookup.ApplyTags(item, itemStatus);
      SUL.locationLookup.updateTargetField(item, SUL.targetField, holdingsFormatted);
    },
    
    async processItemData(responseXML) {
      if (SUL.locationLookup.noResultsFound(responseXML)) {
        return SUL.locationLookup.createNoResultsResponse();
      }
      const eHoldingsData = SUL.locationLookup.processElectronicHoldings(responseXML);
      const pHoldingsData = await SUL.locationLookup.processPrintHoldings(responseXML);
      const holdingsFormatted = `${pHoldingsData.formattedResult}\n${eHoldingsData.formattedResult}`;
      const itemStatus = SUL.locationLookup.mergeItemStatus(eHoldingsData.itemStatus, pHoldingsData.itemStatus);
      SUL.log(`Holdings formatted: ${holdingsFormatted}`);
      return { holdingsFormatted, itemStatus };
    },

    getIsbns(item) {
      let isbns = [];
      if (item.getField("ISBN")) {
        isbns = item.getField("ISBN").split(" ");
        SUL.log("isbns: " + isbns);
      }
      return isbns;
    },

    fetchXML(url) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            if (xhr.status === 200) {
              resolve(xhr);
            } else {
              reject(new Error(`Request failed with status ${xhr.status}`));
            }
          }
        };
        xhr.send();
      });
    },

    ApplyTags(item, itemStatus) {
      const { isInUBBe, isInUBBeKurierbib, isInUBBeOnline, isInUBBeOnlineViaEBA, isWithoutISBN } = itemStatus;
      const tagConditions = [
        { condition: isWithoutISBN, tag: SUL.tags.withoutISBN },
        { condition: !isInUBBe && !isWithoutISBN, tag: SUL.tags.notInUBBE },
        { condition: isInUBBe, tag: SUL.tags.inUBBe },
        { condition: isInUBBeKurierbib, tag: SUL.tags.inUBBeKurierbib },
        { condition: isInUBBeOnline, tag: SUL.tags.inUBBeOnline },
        { condition: isInUBBeOnlineViaEBA, tag: SUL.tags.inUBBeOnlineViaEBA },
      ];
      for (const tag of Object.values(SUL.tags)) {
        if (item.hasTag(tag)) {
          item.removeTag(tag);
        }
      }
      tagConditions.forEach(({ condition, tag }) => {
        if (condition) {
          item.addTag(tag);
        }
      });
    },

    noResultsFound(responseXML) {
      return responseXML.querySelector("searchRetrieveResponse > numberOfRecords").textContent === "0";
    },

    createNoResultsResponse() {
      return {
        holdingsFormatted: SUL.strings.noResults,
        itemStatus: SUL.locationLookup.getDefaultItemStatus()
      };
    },

    async processPrintHoldings(responseXML) {
      let itemStatus = SUL.locationLookup.getDefaultItemStatus();
      let formattedHoldings = [];
      const printHoldings = await SUL.locationLookup.getPrintHoldingsData(responseXML);
      printHoldings.forEach(holding => {
        formattedHoldings.push(SUL.locationLookup.formatPrintHolding(holding));
        SUL.locationLookup.updatePrintItemStatus(itemStatus, holding);
      });
      const formattedResult = formattedHoldings.length > 0
        ? formattedHoldings.join("\n")
        : "Keine Printbestände vorhanden";
      SUL.log("Final Result: " + formattedResult);
      return { formattedResult, itemStatus };
    },

    async getPrintHoldingsData(responseXML) {
      let holdings = [];
      if (!responseXML.querySelector("datafield[tag='AVA']")) {
        return holdings;
      }
      for (const holding of responseXML.querySelectorAll("datafield[tag='AVA']")) {
        holdings.push(await SUL.locationLookup.getPrintHoldingData(holding));
      }
      return holdings;
    },

    async getPrintHoldingData(holding) {
      const holdingLibraryCode = holding.querySelector("subfield[code='b']")?.textContent || "";
      const holdingLibrary = holding.querySelector("subfield[code='q']")?.textContent || holdingLibraryCode;
      const holdingLibraryViaRapido = holding.querySelector("subfield[code='j']")?.textContent === SUL.rapidoCode;
      const holdingLibraryLocation = (holding.querySelector("subfield[code='c']")?.textContent || "") + (holdingLibraryViaRapido ? " (via Rapido)" : "");
      const holdingBibRecordID = holding.querySelector("subfield[code='0']")?.textContent || "";
      const holdingHoldingsID = holding.querySelector("subfield[code='8']")?.textContent || "";
      const holdingItemPolicy = await (async () => {
        if (!holdingLibraryViaRapido) {
          return SUL.apiKey ? await SUL.locationLookup.getItemPolicy(holdingBibRecordID, holdingHoldingsID) : "kein API-Key verfügbar";
        }
        return "";
      })();
      return {
        holdingLibraryCode,
        holdingLibrary,
        holdingLibraryViaRapido,
        holdingLibraryLocation,
        holdingItemPolicy,
        holdingHoldingsID,
        holdingBibRecordID,
      };
    },

    formatPrintHolding(holding) {
      const { holdingLibrary, holdingLibraryLocation, holdingItemPolicy } = holding;
      return `${holdingLibrary}${holdingLibraryLocation ? ", " + holdingLibraryLocation : ""}${holdingItemPolicy ? ", " + holdingItemPolicy : ""}`;
    },

    updatePrintItemStatus(itemStatus, holding) {
      if (holding.holdingLibrary.startsWith("Bern UB") && !holding.holdingLibraryViaRapido) {
        itemStatus.isInUBBe = true;
      }
      if (SUL.kurierbibliothekenUBBe.includes(holding.holdingLibraryCode) && !holding.holdingLibraryViaRapido) {
        itemStatus.isInUBBeKurierbib = true;
      }
    },

    processElectronicHoldings(responseXML) {
      let itemStatus = SUL.locationLookup.getDefaultItemStatus();
      let formattedHoldings = [];
      for (const holding of SUL.locationLookup.getElectronicHoldingsData(responseXML)) {
        const parts = [
          holding.eholdingAvailability,
          holding.eholdingZonesString,
          holding.eholdingPackage
        ].filter(part => part); // Filter out empty strings
        formattedHoldings.push(parts.join(", ")); // Join non-empty parts with commas
        if (holding.eholdingAvailability === "Online verfügbar") {
          if (!holding.eholdingPackage.includes("TEMP")) {
            itemStatus.isInUBBeOnline = true;
            itemStatus.isInUBBe = true;
          } else {
            if (!itemStatus.isInUBBeOnline) itemStatus.isInUBBeOnlineViaEBA = true;
          }
        }
      }
      const formattedResult = formattedHoldings.length > 0 ? formattedHoldings.join("\n") : "Keine elektronischen Bestände vorhanden";
      return { formattedResult, itemStatus };
    },
    

    getElectronicHoldingsData(responseXML) {
      let holdings = [];
      if (!responseXML.querySelector("datafield[tag='AVE']")) {
        SUL.log("No electronic holdings found.");
        return holdings;
      }
      for (const holding of responseXML.querySelectorAll("datafield[tag='AVE']")) {
        holdings.push(SUL.locationLookup.getElectronicHoldingData(holding));
      }
      return holdings;
    },

    getElectronicHoldingData(holding) {
      const eholdingAvailability = holding.querySelector("subfield[code='e']")?.textContent === "Available" 
        ? "Online verfügbar" : "Online nicht verfügbar";
      const eholdingZonesString = this.getAllowedAccessZonesString(
        Array.from(holding.querySelectorAll("subfield[code='b']"))?.map(zone => zone?.textContent) || []
      );
      const eholdingPackage = holding.querySelector("subfield[code='m']") 
        ? holding.querySelector("subfield[code='m']").textContent 
        : "ohne Paketinfos";
      return { eholdingAvailability, eholdingZonesString, eholdingPackage };
    },

    getAllowedAccessZonesString(arr) {
      if (arr.length === 0) {
        return "ohne Infos zu Verfügbarkeiten";
      }
      if (arr.includes("41SLSP_UBE_UNI") && arr.includes("41SLSP_UBE_PH")) {
        return "verfügbar für Uni und PH";
      }
      if (arr.includes("41SLSP_UBE_UNI")) {
        return "verfügbar für Uni";
      }
      if (arr.includes("41SLSP_UBE_PH")) {
        return "verfügbar für PH";
      }
      return "andere Verfügbarkeiten"; // this should not happen
    },
    

    updateTargetField(item, field, holdings) {
      const currentDate = new Date().toLocaleString();
      const holdingsFormattedHeader = `${currentDate} – Bestand UB Bern\n==========================\n`;
      const content = holdingsFormattedHeader + holdings;
      item.setField(field, SUL.locationLookup.contentForTargetField(item, field, content));
    },

    contentForTargetField(item, field, content) {
      const current = item.getField(field);
      return `${content}\n============================\n\n${current}`;
    },

    async getItemPolicy(BibRecordID, HoldingID) {
      const url = `https://api-eu.hosted.exlibrisgroup.com/almaws/v1/bibs/${BibRecordID}/holdings/${HoldingID}/items?format=json&apikey=${SUL.apiKey}`;
      let policy = "Leihbedingungen nicht verfügbar";
      try {
        const response = await fetch(url);
        if (!response.ok) {
          SUL.log(`Error fetching item policy: ${response.statusText}`);
          return policy;
        }
        const parsed = await response.json();
        if (parsed && Array.isArray(parsed.item) && parsed.item.length > 0) {
          policy = parsed.item[0]?.item_data?.policy?.desc || policy;
        } else {
          SUL.log("No item data found in the response");
        }
      } catch (error) {
        SUL.log(`Error processing item policy: ${error.message}`);
      }
      return policy;
    },

    getDefaultItemStatus() {
      return {
        isInUBBe: false,
        isInUBBeOnline: false,
        isInUBBeOnlineViaEBA: false,
        isInUBBeKurierbib: false,
        isWithoutISBN: false,
      };
    },

    mergeItemStatus(...statuses) {
      return statuses.reduce((merged, status) => {
        for (let key in status) {
          if (status.hasOwnProperty(key)) {
            merged[key] = merged[key] || status[key];
          }
        }
        return merged;
      }, {});
    },

  },

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  // GENERIC HELPER FUNCTIONS
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////

  helpers: {


    isValidIsbn(isbn) {
      isbn = isbn.replace(/[^0-9X]/gi, "");
      if (isbn.length !== 10 && isbn.length !== 13) {
        SUL.log(`Invalid ISBN length: ${isbn.length}`);
        return false;
      }
      if (isbn.length === 13) {
        const isValid = SUL.helpers.isValidISBN13(isbn);
        SUL.log(`ISBN-13 validation result for ${isbn}: ${isValid}`);
        return isValid;
      }
      if (isbn.length === 10) {
        const isValid = SUL.helpers.isValidISBN10(isbn);
        SUL.log(`ISBN-10 validation result for ${isbn}: ${isValid}`);
        return isValid;
      }
      return false;
    },

    isValidISBN13(isbn) {
      const digits = isbn.split("").map(x => parseInt(x, 10));
      const sum = digits.slice(0, -1).reduce((acc, val, index) => {
        const isEvenIndex = index % 2 === 0;
        const multipliedVal = isEvenIndex ? val : val * 3;
        return acc + multipliedVal;
      }, 0);
      const lastDigit = digits[12];
      const checksum = (10 - (sum % 10)) % 10;
      return checksum === lastDigit;
    },

    isValidISBN10(isbn) {
      const digits = isbn.split("");
      const lastValue = digits.pop();
      const multiplicator = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const sum = digits.reduce((acc, val, i) => acc + parseInt(val, 10) * multiplicator[i], 0);
      const checksum = sum % 11;
      return checksum === 10 ? lastValue === "X" : checksum === parseInt(lastValue, 10);
    },
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SUL;
}
