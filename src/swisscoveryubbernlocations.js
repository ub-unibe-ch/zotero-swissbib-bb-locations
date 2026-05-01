const ddcData = require("./data/ddc-codes.js");
const bcData = require("./data/bc-codes.js");
const pickerCSS = require("./picker.css");

function debug(msg) {
  try { Zotero.debug(msg); } catch (e) {}
}

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
  _shortcutHandlers: new WeakMap(),
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
  get shortcutDDC() {
    return Pref.get("shortcutDDC");
  },
  get shortcutBC() {
    return Pref.get("shortcutBC");
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
              l10nID: "zoteroswisscoveryubbernlocations-itemmenu-pickBC",
              onCommand: () => SUL.bcPicker.pickAndApply(),
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

  parseShortcut(prefValue) {
    if (!prefValue) return null;
    const parts = prefValue.split(",").map(s => s.trim().toLowerCase());
    const result = { accel: false, alt: false, shift: false, key: "" };
    for (const part of parts) {
      if (part === "accel") result.accel = true;
      else if (part === "alt") result.alt = true;
      else if (part === "shift") result.shift = true;
      else result.key = part.toUpperCase();
    }
    return result.key ? result : null;
  },

  matchShortcut(parsed, e) {
    const accel = Zotero.isMac ? e.metaKey : e.ctrlKey;
    return parsed.accel === accel
      && parsed.alt === e.altKey
      && parsed.shift === e.shiftKey
      && parsed.key === e.key.toUpperCase();
  },

  registerShortcuts(win) {
    const handler = (e) => {
      const ddc = SUL.parseShortcut(SUL.shortcutDDC);
      const bc = SUL.parseShortcut(SUL.shortcutBC);
      if (ddc && SUL.matchShortcut(ddc, e)) {
        e.preventDefault();
        e.stopPropagation();
        SUL.ddcPicker.pickAndApply();
      } else if (bc && SUL.matchShortcut(bc, e)) {
        e.preventDefault();
        e.stopPropagation();
        SUL.bcPicker.pickAndApply();
      }
    };
    win.addEventListener("keydown", handler, true);
    SUL._shortcutHandlers.set(win, handler);
  },

  unregisterShortcuts(win) {
    const handler = SUL._shortcutHandlers.get(win);
    if (handler) {
      win.removeEventListener("keydown", handler, true);
      SUL._shortcutHandlers.delete(win);
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
  // Accepts flat `entries` (legacy) or `groups: [{label, entries}]`.
  // Pass `allowFreeText: true` to enable free-text fallback.
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////

  picker: {
    show({ title, entries, groups, allowFreeText, existingCodes, partialCodes, itemCount }) {
      return new Promise((resolve) => {
        let resolved = false;
        const safeResolve = (val) => {
          if (resolved) return;
          resolved = true;
          debug(`[SUL picker] resolve: ${JSON.stringify(val)}`);
          resolve(val);
        };
        const win = Zotero.getMainWindow();
        const normalizedGroups = groups || (entries ? [{ label: null, entries }] : []);
        const io = {
          title,
          groups: normalizedGroups,
          allowFreeText: !!allowFreeText,
          existingCodes: existingCodes || new Set(),
          partialCodes: partialCodes || new Set(),
          itemCount: itemCount || 1,
          result: null,
        };
        const dialog = win.openDialog(
          "about:blank",
          "sul-picker",
          "centerscreen,resizable=yes,dependent=yes,width=420,height=500",
          io,
        );
        dialog.addEventListener(
          "DOMContentLoaded",
          () => {
            debug(`[SUL picker] DOMContentLoaded`);
            SUL.picker.build(dialog, safeResolve);
            dialog.addEventListener(
              "unload",
              () => {
                debug(`[SUL picker] unload (safety net)`);
                safeResolve(null);
              },
              { once: true },
            );
          },
          { once: true },
        );
      });
    },

    buildDOM(doc, io) {
      const allowFreeText = !!io.allowFreeText;

      const style = doc.createElement("style");
      style.textContent = pickerCSS;
      doc.head.appendChild(style);

      const filter = doc.createElement("input");
      filter.id = "sul-filter";
      filter.type = "text";
      filter.placeholder = allowFreeText ? "Filter / Freitext…" : "Filter…";
      doc.body.appendChild(filter);

      const results = doc.createElement("ul");
      results.id = "sul-results";
      doc.body.appendChild(results);

      const footer = doc.createElement("div");
      footer.id = "sul-footer";
      const existingRow = doc.createElement("div");
      existingRow.id = "sul-footer-existing";
      existingRow.className = "sul-footer-row";
      existingRow.style.display = "none";
      const existingLabel = doc.createElement("span");
      existingLabel.className = "sul-footer-label";
      existingLabel.textContent = io.itemCount > 1 ? "Vergeben (alle):" : "Vergeben:";
      const existingTags = doc.createElement("span");
      existingTags.id = "sul-footer-existing-tags";
      existingRow.appendChild(existingLabel);
      existingRow.appendChild(existingTags);
      footer.appendChild(existingRow);
      const partialRow = doc.createElement("div");
      partialRow.id = "sul-footer-partial";
      partialRow.className = "sul-footer-row";
      partialRow.style.display = "none";
      const partialLabel = doc.createElement("span");
      partialLabel.className = "sul-footer-label";
      partialLabel.textContent = "Vergeben (teilweise):";
      const partialTags = doc.createElement("span");
      partialTags.id = "sul-footer-partial-tags";
      partialRow.appendChild(partialLabel);
      partialRow.appendChild(partialTags);
      footer.appendChild(partialRow);
      const selectedRow = doc.createElement("div");
      selectedRow.className = "sul-footer-row";
      const footerLabel = doc.createElement("span");
      footerLabel.className = "sul-footer-label";
      footerLabel.textContent = "Auswahl:";
      const footerTags = doc.createElement("span");
      footerTags.id = "sul-footer-tags";
      selectedRow.appendChild(footerLabel);
      selectedRow.appendChild(footerTags);
      footer.appendChild(selectedRow);
      const hint = doc.createElement("div");
      hint.id = "sul-footer-hint";
      const legend = doc.createElement("div");
      legend.textContent = "✓ ausgewählt · ● alle haben es · ◔ manche haben es";
      const keys = doc.createElement("div");
      keys.textContent = "Enter: wählen · Shift+Enter: wählen + Filter löschen · Ctrl+Enter: übernehmen · Esc: abbrechen";
      hint.appendChild(legend);
      hint.appendChild(keys);
      footer.appendChild(hint);
      doc.body.appendChild(footer);

      return {
        filter,
        results,
        footer: { existingRow, existingTags, partialRow, partialTags, footerTags },
      };
    },

    build(dialog, safeResolve) {
      const io = dialog.arguments[0];
      const doc = dialog.document;
      const baseTitle = io.title || "";
      if (baseTitle) doc.title = baseTitle;

      const allGroups = Array.isArray(io.groups) ? io.groups : [];
      const allEntries = allGroups.flatMap(g => g.entries || []);
      const allowFreeText = !!io.allowFreeText;

      const { filter, results, footer } = SUL.picker.buildDOM(doc, io);
      const { existingRow, existingTags, partialRow, partialTags, footerTags } = footer;

      const existingCodes = io.existingCodes instanceof Set ? io.existingCodes : new Set(io.existingCodes || []);
      const partialCodes = io.partialCodes instanceof Set ? io.partialCodes : new Set(io.partialCodes || []);
      const picked = new Map(); // key: code-or-text, value: {freeText?: boolean}
      let visible = [];
      let activeIdx = 0;

      function updateTitle() {
        const n = picked.size;
        doc.title = n > 0 ? `${baseTitle} (${n} ausgewählt)` : baseTitle;
      }

      function toggleEntry(entry, resetFilter) {
        if (entry.freeTextCandidate) {
          const text = filter.value.trim();
          if (text) {
            picked.set(text, { freeText: true });
            filter.value = "";
            activeIdx = 0;
            updateTitle();
            updateFooter();
            render();
            filter.focus();
          }
          return;
        }
        if (existingCodes.has(entry.code)) return;
        if (picked.has(entry.code)) {
          picked.delete(entry.code);
        } else {
          picked.set(entry.code, {});
        }
        updateTitle();
        updateFooter();
        if (resetFilter) {
          filter.value = "";
          activeIdx = 0;
        }
        render();
        filter.focus();
      }

      function renderChipRow(rowEl, containerEl, chips, extraClass, fallback) {
        containerEl.replaceChildren();
        if (chips.length === 0) {
          if (rowEl) rowEl.style.display = "none";
          if (fallback != null) containerEl.textContent = fallback;
          return;
        }
        if (rowEl) rowEl.style.display = "";
        for (const text of chips) {
          const chip = doc.createElement("span");
          chip.className = extraClass ? `sul-footer-tag ${extraClass}` : "sul-footer-tag";
          chip.textContent = text;
          containerEl.appendChild(chip);
        }
      }

      function updateFooter() {
        const selectedChips = [...picked.keys()];
        renderChipRow(null, footerTags, selectedChips, null, "—");

        renderChipRow(
          existingRow,
          existingTags,
          allEntries.filter(e => existingCodes.has(e.code)).map(e => e.code),
          "sul-footer-existing-tag",
        );

        renderChipRow(
          partialRow,
          partialTags,
          allEntries.filter(e => partialCodes.has(e.code)).map(e => e.code),
          "sul-footer-partial-tag",
        );
      }

      function render() {
        const q = filter.value.trim().toLowerCase();
        visible = [];
        results.replaceChildren();

        const hasCodeMatch = q && allGroups.some(g =>
          (g.entries || []).some(e => String(e.code).toLowerCase().startsWith(q))
        );
        const filteredGroups = allGroups.map(g => ({
          label: g.label,
          entries: !q
            ? (g.entries || []).slice()
            : (g.entries || []).filter(e =>
                hasCodeMatch
                  ? String(e.code).toLowerCase().startsWith(q)
                  : String(e.label).toLowerCase().includes(q)
              ),
        })).filter(g => g.entries.length > 0);

        if (filteredGroups.length === 0) {
          if (allowFreeText && q) {
            const entry = { code: q, label: `"${q}" hinzufügen`, freeTextCandidate: true };
            visible = [entry];
            activeIdx = 0;
            const li = doc.createElement("li");
            li.className = "add-freetext active";
            li.dataset.entryIndex = "0";
            li.textContent = `+ "${q}" hinzufügen`;
            li.addEventListener("click", () => toggleEntry(entry, false));
            results.appendChild(li);
          } else {
            const li = doc.createElement("li");
            li.className = "empty";
            li.textContent = "Keine Treffer";
            results.appendChild(li);
          }
          return;
        }

        const totalEntries = filteredGroups.reduce((n, g) => n + g.entries.length, 0);
        if (activeIdx >= totalEntries) activeIdx = 0;

        filteredGroups.forEach(group => {
          if (group.label) {
            const header = doc.createElement("li");
            header.className = "group-header";
            header.textContent = group.label;
            results.appendChild(header);
          }
          group.entries.forEach(entry => {
            const entryIdx = visible.length;
            visible.push(entry);
            const li = doc.createElement("li");
            li.dataset.entryIndex = String(entryIdx);
            const isExisting = existingCodes.has(entry.code);
            const isPartial = partialCodes.has(entry.code);
            const mark = doc.createElement("span");
            mark.className = "sul-mark";
            if (picked.has(entry.code)) {
              mark.classList.add("selected");
              mark.textContent = "✓";
            } else if (isExisting) {
              mark.classList.add("existing");
              mark.textContent = "●";
            } else if (isPartial) {
              mark.classList.add("partial");
              mark.textContent = "◔";
            } else {
              mark.textContent = "✓";
              mark.style.visibility = "hidden";
            }
            const body = doc.createElement("span");
            body.className = "sul-entry-body";
            const code = doc.createElement("span");
            code.className = "sul-code";
            code.textContent = entry.code;
            body.appendChild(code);
            if (entry.label) {
              const label = doc.createElement("span");
              label.className = "sul-label";
              label.textContent = entry.label;
              body.appendChild(label);
            }
            if (entry.hint) {
              const hintEl = doc.createElement("span");
              hintEl.className = "sul-hint";
              hintEl.textContent = entry.hint;
              body.appendChild(hintEl);
            }
            li.appendChild(mark);
            li.appendChild(body);
            if (entryIdx === activeIdx) li.classList.add("active");
            if (isExisting) li.classList.add("existing");
            if (isPartial && !isExisting) li.classList.add("partial");
            li.addEventListener("click", () => {
              if (isExisting) return;
              debug(`[SUL picker] click: ${entry.code}`);
              toggleEntry(entry, false);
            });
            li.addEventListener("mousemove", () => setActive(entryIdx));
            results.appendChild(li);
          });
        });
      }

      function setActive(i) {
        if (!visible.length) return;
        activeIdx = Math.max(0, Math.min(i, visible.length - 1));
        results.querySelectorAll("li[data-entry-index]").forEach(el => {
          el.classList.toggle("active", parseInt(el.dataset.entryIndex) === activeIdx);
        });
        const activeEl = results.querySelector(`li[data-entry-index="${activeIdx}"]`);
        if (activeEl?.scrollIntoView) activeEl.scrollIntoView({ block: "nearest" });
      }

      filter.addEventListener("input", () => {
        activeIdx = 0;
        render();
      });
      filter.addEventListener("keydown", (e) => {
        debug(`[SUL picker] keydown: ${e.key} ctrl=${e.ctrlKey}`);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive(activeIdx + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive(activeIdx - 1);
        } else if (e.key === "Enter" && e.ctrlKey) {
          e.preventDefault();
          if (picked.size === 0) return;
          const result = [...picked].map(([code, meta]) =>
            meta.freeText ? { code, freeText: true } : { code }
          );
          safeResolve(result);
          try { dialog.close(); } catch (err) {}
        } else if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          if (!visible.length) return;
          toggleEntry(visible[activeIdx], true);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (!visible.length) return;
          toggleEntry(visible[activeIdx], false);
        } else if (e.key === "Escape") {
          e.preventDefault();
          safeResolve(null);
          try { dialog.close(); } catch (err) {}
        }
      });

      render();
      updateFooter();
      filter.focus();
    },

    collectExistingCodes(items, prefix) {
      const existing = new Set();
      const partial = new Set();
      const perItem = items.map(item =>
        new Set(
          item.getTags()
            .filter(t => t.tag.startsWith(prefix))
            .map(t => t.tag.substring(prefix.length))
        )
      );
      const allCodes = new Set(perItem.flatMap(s => [...s]));
      allCodes.forEach(code => {
        const count = perItem.filter(s => s.has(code)).length;
        if (count === items.length) existing.add(code);
        else partial.add(code);
      });
      return { existing, partial };
    },

    async pickAndApply({ prefix, titleSingular, titlePlural, groups, allowFreeText }) {
      const items = Zotero.getActiveZoteroPane().getSelectedItems();
      if (!items.length) return;
      const { existing, partial } = SUL.picker.collectExistingCodes(items, prefix);
      const title = items.length === 1 ? titleSingular : `${titlePlural} (${items.length} Titel)`;
      const choices = await SUL.picker.show({
        title,
        groups,
        allowFreeText: !!allowFreeText,
        existingCodes: existing,
        partialCodes: partial,
        itemCount: items.length,
      });
      if (!choices) return;
      const tags = choices.map(e => `${prefix}${e.code}`);
      await Zotero.DB.executeTransaction(async () => {
        for (const item of items) {
          for (const tag of tags) item.addTag(tag, 0);
          await item.save();
        }
      });
    },
  },

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  // DDC PICKER
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////

  ddcPicker: {
    ...ddcData,
    pickAndApply() {
      return SUL.picker.pickAndApply({
        prefix: "DDC ",
        titleSingular: "DDC-Tag wählen",
        titlePlural: "DDC-Tag wählen",
        groups: SUL.ddcPicker.groups,
      });
    },
  },

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  // BC PICKER
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////

  bcPicker: {
    ...bcData,
    pickAndApply() {
      return SUL.picker.pickAndApply({
        prefix: "BC ",
        titleSingular: "Bestellcode wählen",
        titlePlural: "Bestellcode wählen",
        groups: SUL.bcPicker.groups,
        allowFreeText: SUL.bcPicker.allowFreeText,
      });
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
        ].filter(part => part);
        formattedHoldings.push(parts.join(", "));
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
