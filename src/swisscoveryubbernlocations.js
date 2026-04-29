// Preference utility wrapper
const PREFS_PREFIX = "extensions.swisscoveryubbernlocations.";
const DEFAULTS = globalThis.__PREF_DEFAULTS__ || {};

const Pref = {
  get(key) {
    try {
      return Zotero.Prefs.get(PREFS_PREFIX + key, true) ?? DEFAULTS[key];
    } catch (e) {
      return DEFAULTS[key];
    }
  },
  set(key, value) {
    Zotero.Prefs.set(PREFS_PREFIX + key, value, true);
  },
  get sruurl() { return this.get("sruurl"); },
  get apikey() { return this.get("apikey"); },
  get targetField() { return this.get("targetField"); },
  get debug() { return this.get("debug"); },
};

SUL = {
  id: null,
  version: null,
  rootURI: null,
  initialized: false,
  menuID: null,
  ftlFilename: "zoteroswisscoveryubbernlocations-ubbernlocations.ftl",

  init({ id, version, rootURI }) {
    if (this.initialized) return;
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;
  },

  get sruPrefix() {
    return Pref.sruurl;
  },
  get apiKey() {
    return Pref.apikey;
  },
  get targetField() {
    return Pref.targetField;
  },

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

  ensureFTL(window) {
    if (!window?.MozXULElement) return;
    window.MozXULElement.insertFTLIfNeeded(this.ftlFilename);
  },

  registerMenu() {
    this.menuID = Zotero.MenuManager.registerMenu({
      menuID: "swisscoveryubbernlocations-itemmenu",
      pluginID: this.id,
      target: "main/library/item",
      menus: [
        {
          menuType: "submenu",
          l10nID: "zoteroswisscoveryubbernlocations-itemmenu-submenu",
          icon: this.rootURI + "content/icons/glass_48.png",
          menus: [
            {
              menuType: "menuitem",
              l10nID: "zoteroswisscoveryubbernlocations-itemmenu-locationlookup",
              onCommand: () => SUL.locationLookup.LocationLookup(),
            },
            {
              menuType: "menuitem",
              l10nID: "zoteroswisscoveryubbernlocations-itemmenu-orderNoteToAbstract",
              onCommand: () => SUL.orderNote.addOrderNote(),
            },
            {
              menuType: "menuitem",
              l10nID: "zoteroswisscoveryubbernlocations-itemmenu-pickDDC",
              onCommand: () => SUL.ddcPicker.pickAndApply(),
            },
            {
              menuType: "menuitem",
              l10nID: "zoteroswisscoveryubbernlocations-itemmenu-clearOrderNotes",
              onShowing: (event, context) => context.setVisible(Pref.debug),
              onCommand: () => SUL.orderNote.clearOrderNotes(),
            },
          ],
        },
      ],
    });
  },

  unregisterMenu() {
    if (this.menuID) {
      Zotero.MenuManager.unregisterMenu(this.menuID);
      this.menuID = null;
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
      SUL.log(`addOrderNote: processing ${items.length} items`);
      await Zotero.DB.executeTransaction(async () => {
        for (const [i, item] of items.entries()) {
          const title = item.getField("title");
          const tags = item.getTags();
          SUL.log(`addOrderNote [${i + 1}/${items.length}] "${title}": ${tags.length} tags`);
          const { ddcs, orderCodes, budgetCode } = SUL.orderNote.extractTags(tags);
          SUL.log(`addOrderNote [${i + 1}/${items.length}] ETAT="${budgetCode}" DDC=[${ddcs}] BC=[${orderCodes}]`);

          const missing = [];
          if (!budgetCode) missing.push("ETAT");
          if (!ddcs.length) missing.push("DDC");

          let value;
          if (missing.length) {
            value = `⚠ FEHLT: ${missing.join(", ")}`;
          } else {
            value = SUL.orderNote.constructOrderNote({ ddcs, orderCodes, budgetCode });
          }
          if (Pref.debug) {
            value += ` [${new Date().toLocaleString()}]`;
          }
          SUL.log(`addOrderNote [${i + 1}/${items.length}] result: "${value}"`);

          item.setField("volume", value);
          await item.save();
        }
      });
    },

    async clearOrderNotes() {
      const ZoteroPane = Zotero.getActiveZoteroPane();
      const selectedItems = ZoteroPane.getSelectedItems();
      const items = selectedItems.filter(
        (item) => item.itemTypeID === Zotero.ItemTypes.getID("book")
      );
      await Zotero.DB.executeTransaction(async () => {
        for (const item of items) {
          item.setField("volume", "");
          await item.save();
        }
      });
      SUL.log(`clearOrderNotes: cleared ${items.length} items`);
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
  // PICKER (generic search-and-pick dialog)
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////

  picker: {
    show({ title, entries }) {
      return new Promise((resolve) => {
        const win = Zotero.getMainWindow();
        const io = { title, entries, result: null };
        const dialog = win.openDialog(
          "about:blank",
          "sul-picker",
          "chrome,centerscreen,resizable=yes,dependent=yes,width=420,height=440",
          io,
        );
        dialog.addEventListener(
          "load",
          () => SUL.picker.build(dialog, io),
          { once: true },
        );
        dialog.addEventListener(
          "unload",
          () => resolve(io.result),
          { once: true },
        );
      });
    },

    build(dialog, io) {
      const doc = dialog.document;
      if (io.title) doc.title = io.title;

      const style = doc.createElement("style");
      style.textContent = `
        body { margin: 0; padding: 12px; font-family: sans-serif; }
        #sul-filter { width: 100%; padding: 6px 8px; box-sizing: border-box; font-size: 13px; }
        #sul-results { list-style: none; margin: 8px 0 0 0; padding: 0; max-height: 360px; overflow-y: auto; border: 1px solid #ccc; }
        #sul-results li { padding: 6px 10px; cursor: pointer; display: flex; flex-wrap: wrap; column-gap: 10px; row-gap: 2px; align-items: baseline; }
        #sul-results li.active { background: #2a7ad4; color: #fff; }
        #sul-results li:hover:not(.active) { background: #e6effc; }
        #sul-results li.empty { color: #888; font-style: italic; cursor: default; }
        #sul-results li.empty:hover { background: transparent; }
        .sul-code { font-weight: 600; min-width: 48px; flex-shrink: 0; }
        .sul-label { flex: 1 1 0; min-width: 0; }
        .sul-hint { font-size: 11px; color: #888; font-style: italic; flex-basis: 100%; padding-left: 58px; }
        #sul-results li.active .sul-hint { color: rgba(255,255,255,0.85); }
      `;
      doc.head.appendChild(style);

      const filter = doc.createElement("input");
      filter.id = "sul-filter";
      filter.type = "text";
      filter.placeholder = "Filter…";
      doc.body.appendChild(filter);

      const results = doc.createElement("ul");
      results.id = "sul-results";
      doc.body.appendChild(results);

      const entries = Array.isArray(io.entries) ? io.entries : [];
      let visible = [];
      let activeIdx = 0;

      function render() {
        const q = filter.value.trim().toLowerCase();
        visible = q
          ? entries.filter(
              (e) =>
                String(e.code).toLowerCase().startsWith(q) ||
                String(e.label).toLowerCase().includes(q),
            )
          : entries.slice();

        results.replaceChildren();

        if (!visible.length) {
          const li = doc.createElement("li");
          li.className = "empty";
          li.textContent = "Keine Treffer";
          results.appendChild(li);
          return;
        }

        if (activeIdx >= visible.length) activeIdx = 0;

        visible.forEach((entry, i) => {
          const li = doc.createElement("li");
          const code = doc.createElement("span");
          code.className = "sul-code";
          code.textContent = entry.code;
          const label = doc.createElement("span");
          label.className = "sul-label";
          label.textContent = entry.label;
          li.appendChild(code);
          li.appendChild(label);
          if (entry.hint) {
            const hint = doc.createElement("span");
            hint.className = "sul-hint";
            hint.textContent = entry.hint;
            li.appendChild(hint);
          }
          if (i === activeIdx) li.classList.add("active");
          li.addEventListener("click", () => commit(i));
          li.addEventListener("mousemove", () => setActive(i));
          results.appendChild(li);
        });
      }

      function setActive(i) {
        if (!visible.length) return;
        activeIdx = Math.max(0, Math.min(i, visible.length - 1));
        const children = results.children;
        for (let idx = 0; idx < children.length; idx++) {
          children[idx].classList.toggle("active", idx === activeIdx);
        }
        const el = children[activeIdx];
        if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
      }

      function commit(i) {
        if (!visible.length) return;
        io.result = visible[i];
        dialog.close();
      }

      filter.addEventListener("input", () => {
        activeIdx = 0;
        render();
      });
      filter.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive(activeIdx + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive(activeIdx - 1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          commit(activeIdx);
        } else if (e.key === "Escape") {
          e.preventDefault();
          dialog.close();
        }
      });

      render();
      filter.focus();
    },
  },

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  // DDC PICKER
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////

  ddcPicker: {
    entries: [
      { code: "000", label: "Allgemeines, Wissenschaft" },
      { code: "004", label: "Informatik" },
      { code: "010", label: "Bibliografien" },
      { code: "020", label: "Bibliotheks- und Informationswissenschaft" },
      { code: "030", label: "Enzyklopädien" },
      { code: "050", label: "Zeitschriften, fortlaufende Sammelwerke" },
      { code: "060", label: "Organisationen, Museumswissenschaft" },
      { code: "070", label: "Nachrichtenmedien, Journalismus, Verlagswesen" },
      { code: "080", label: "Allgemeine Sammelwerke" },
      { code: "090", label: "Handschriften, seltene Bücher" },

      { code: "100", label: "Philosophie" },
      { code: "130", label: "Parapsychologie, Okkultismus" },
      { code: "150", label: "Psychologie" },

      { code: "200", label: "Religion, Religionsphilosophie" },
      { code: "220", label: "Bibel" },
      { code: "230", label: "Theologie, Christentum" },
      { code: "290", label: "Andere Religionen" },

      { code: "300", label: "Sozialwissenschaften, Soziologie, Anthropologie" },
      { code: "310", label: "Allgemeine Statistiken" },
      { code: "320", label: "Politik" },
      { code: "330", label: "Wirtschaft", hint: "Management → 650" },
      { code: "333.7", label: "Natürliche Ressourcen, Energie und Umwelt" },
      { code: "340", label: "Recht", hint: "Kriminologie, Strafvollzug → 360" },
      { code: "350", label: "Öffentliche Verwaltung" },
      { code: "355", label: "Militär" },
      { code: "360", label: "Soziale Probleme, Sozialdienste, Versicherungen" },
      { code: "370", label: "Erziehung, Schul- und Bildungswesen" },
      { code: "380", label: "Handel, Kommunikation, Verkehr", hint: "Philatelie → 760" },
      { code: "390", label: "Bräuche, Etikette, Folklore" },

      { code: "400", label: "Sprache, Linguistik" },
      { code: "420", label: "Englisch" },
      { code: "430", label: "Deutsch" },
      { code: "439", label: "Andere germanische Sprachen" },
      { code: "440", label: "Französisch, romanische Sprachen allgemein" },
      { code: "450", label: "Italienisch, Rumänisch, Rätoromanisch" },
      { code: "460", label: "Spanisch, Portugiesisch" },
      { code: "470", label: "Latein" },
      { code: "480", label: "Griechisch" },
      { code: "490", label: "Andere Sprachen" },
      { code: "491.8", label: "Slawische Sprachen" },

      { code: "500", label: "Naturwissenschaften" },
      { code: "510", label: "Mathematik" },
      { code: "520", label: "Astronomie, Kartografie" },
      { code: "530", label: "Physik" },
      { code: "540", label: "Chemie", hint: "Biochemie → 570" },
      { code: "550", label: "Geowissenschaften", hint: "Kartografie, Geodäsie → 520; Kristallografie, Mineralogie → 540" },
      { code: "560", label: "Paläontologie" },
      { code: "570", label: "Biowissenschaften, Biologie" },
      { code: "580", label: "Pflanzen (Botanik)" },
      { code: "590", label: "Tiere (Zoologie)" },

      { code: "600", label: "Technik" },
      { code: "610", label: "Medizin, Gesundheit", hint: "Veterinärmedizin → 630" },
      { code: "620", label: "Ingenieurwissenschaften und Maschinenbau" },
      { code: "621.3", label: "Elektrotechnik, Elektronik" },
      { code: "624", label: "Ingenieurbau und Umwelttechnik" },
      { code: "630", label: "Landwirtschaft, Veterinärmedizin" },
      { code: "640", label: "Hauswirtschaft und Familienleben" },
      { code: "650", label: "Management" },
      { code: "660", label: "Technische Chemie" },
      { code: "670", label: "Industrielle und handwerkliche Fertigung" },
      { code: "690", label: "Hausbau, Bauhandwerk" },

      { code: "700", label: "Künste, Bildende Kunst allgemein" },
      { code: "710", label: "Landschaftsgestaltung, Raumplanung" },
      { code: "720", label: "Architektur" },
      { code: "730", label: "Plastik, Numismatik, Keramik, Metallkunst" },
      { code: "740", label: "Grafik, angewandte Kunst" },
      { code: "741.5", label: "Comics, Cartoons, Karikaturen" },
      { code: "750", label: "Malerei" },
      { code: "760", label: "Druckgrafik, Drucke" },
      { code: "770", label: "Fotografie, Video, Computerkunst" },
      { code: "780", label: "Musik" },
      { code: "790", label: "Freizeitgestaltung, Darstellende Kunst" },
      { code: "791", label: "Öffentliche Darbietungen, Film, Rundfunk" },
      { code: "792", label: "Theater, Tanz" },
      { code: "793", label: "Spiel" },
      { code: "796", label: "Sport" },

      { code: "800", label: "Literatur, Rhetorik, Literaturwissenschaft" },
      { code: "810", label: "Englische Literatur Amerikas" },
      { code: "820", label: "Englische Literatur" },
      { code: "830", label: "Deutsche Literatur" },
      { code: "839", label: "Literatur in anderen germanischen Sprachen" },
      { code: "840", label: "Französische Literatur" },
      { code: "850", label: "Italienische, rumänische, rätoromanische Literatur" },
      { code: "860", label: "Spanische und portugiesische Literatur" },
      { code: "870", label: "Lateinische Literatur" },
      { code: "880", label: "Griechische Literatur" },
      { code: "890", label: "Literatur in anderen Sprachen" },
      { code: "891.8", label: "Slawische Literatur" },

      { code: "900", label: "Geschichte" },
      { code: "910", label: "Geografie, Reisen" },
      { code: "914.94", label: "Geografie, Reisen (Schweiz)" },
      { code: "920", label: "Biografie, Genealogie, Heraldik" },
      { code: "930", label: "Alte Geschichte, Archäologie" },
      { code: "940", label: "Geschichte Europas" },
      { code: "949.4", label: "Geschichte der Schweiz" },
      { code: "950", label: "Geschichte Asiens" },
      { code: "960", label: "Geschichte Afrikas" },
      { code: "970", label: "Geschichte Nordamerikas" },
      { code: "980", label: "Geschichte Südamerikas" },
      { code: "990", label: "Geschichte der übrigen Welt" },

      { code: "B", label: "Belletristik", hint: "nur zusätzlich zu 800-890" },
      { code: "K", label: "Kinder- und Jugendliteratur" },
      { code: "S", label: "Schulbücher" },
    ],

    async pickAndApply() {
      const ZoteroPane = Zotero.getActiveZoteroPane();
      const items = ZoteroPane.getSelectedItems();
      if (!items.length) {
        SUL.log("ddcPicker: no items selected");
        return;
      }
      const choice = await SUL.picker.show({
        title: "DDC-Tag wählen",
        entries: SUL.ddcPicker.entries,
      });
      if (!choice) {
        SUL.log("ddcPicker: cancelled");
        return;
      }
      const tag = `DDC ${choice.code}`;
      await Zotero.DB.executeTransaction(async () => {
        for (const item of items) {
          item.addTag(tag, 0);
          await item.save();
        }
      });
      SUL.log(`ddcPicker: added "${tag}" to ${items.length} item(s)`);
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

// Export for Zotero (global scope)
// In Zotero bootstrap context, 'self' or the global scope works better than 'window'
if (typeof self !== 'undefined') {
  self.SUL = SUL;
}
if (typeof window !== 'undefined') {
  window.SUL = SUL;
}
// Export for Node.js/module environments (Jest tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SUL;
}
