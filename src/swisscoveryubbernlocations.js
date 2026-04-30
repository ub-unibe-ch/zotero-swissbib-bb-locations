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
          try { Zotero.debug(`[SUL picker] resolve: ${JSON.stringify(val)}`); } catch (e) {}
          resolve(val);
        };
        SUL.picker._currentResolve = safeResolve;
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
            try { Zotero.debug(`[SUL picker] DOMContentLoaded`); } catch (e) {}
            SUL.picker.build(dialog);
            dialog.addEventListener(
              "unload",
              () => {
                try { Zotero.debug(`[SUL picker] unload (safety net)`); } catch (e) {}
                safeResolve(null);
              },
              { once: true },
            );
          },
          { once: true },
        );
      });
    },

    _currentResolve: null,

    build(dialog) {
      const io = dialog.arguments[0];
      const doc = dialog.document;
      const baseTitle = io.title || "";
      if (baseTitle) doc.title = baseTitle;

      const allGroups = Array.isArray(io.groups) ? io.groups : [];
      const allEntries = allGroups.flatMap(g => g.entries || []);
      const allowFreeText = !!io.allowFreeText;

      const style = doc.createElement("style");
      style.textContent = `
        body { margin: 0; padding: 12px; font-family: sans-serif; display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; }
        #sul-filter { width: 100%; padding: 6px 8px; box-sizing: border-box; font-size: 13px; flex-shrink: 0; }
        #sul-results { list-style: none; margin: 8px 0 0 0; padding: 0; flex: 1 1 0; overflow-y: auto; border: 1px solid #ccc; }
        #sul-results li { padding: 5px 10px; cursor: pointer; display: flex; gap: 6px; align-items: flex-start; }
        #sul-results li.active { background: #2a7ad4; color: #fff; }
        #sul-results li:hover:not(.active):not(.group-header) { background: #e6effc; }
        #sul-results li.empty { color: #888; font-style: italic; cursor: default; }
        #sul-results li.empty:hover { background: transparent; }
        #sul-results li.existing { color: #888; cursor: default; }
        #sul-results li.existing:hover { background: transparent; }
        #sul-results li.existing.active { background: #2a7ad4; color: #fff; }
        #sul-results li.partial { color: #666; }
        #sul-results li.group-header { display: block; font-size: 11px; font-weight: 600; color: #666; background: #f0f0f0; cursor: default; padding: 3px 10px; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid #ddd; }
        #sul-results li.group-header:first-child { border-top: none; }
        #sul-results li.add-freetext { color: #2a7ad4; font-style: italic; }
        #sul-results li.add-freetext.active { background: #2a7ad4; color: #fff; font-style: italic; }
        .sul-mark { width: 18px; text-align: center; font-weight: 700; flex-shrink: 0; line-height: 1.4; }
        .sul-mark.selected { color: #2a7ad4; }
        .sul-mark.existing { color: #c77600; }
        .sul-mark.partial { color: #c77600; opacity: 0.5; }
        #sul-results li.active .sul-mark { color: #fff; }
        .sul-entry-body { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .sul-code { font-weight: 600; line-height: 1.4; }
        .sul-label { font-size: 11px; color: #777; line-height: 1.3; }
        #sul-results li.active .sul-label { color: rgba(255,255,255,0.85); }
        .sul-hint { font-size: 10px; color: #999; font-style: italic; }
        #sul-results li.active .sul-hint { color: rgba(255,255,255,0.75); }
        #sul-footer { margin-top: 8px; padding: 6px 10px; border-top: 1px solid #ccc; font-size: 12px; color: #555; display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
        .sul-footer-row { display: flex; gap: 6px; align-items: baseline; }
        .sul-footer-label { font-weight: 600; flex-shrink: 0; }
        #sul-footer-tags, #sul-footer-existing-tags { display: flex; flex-wrap: wrap; gap: 4px; }
        #sul-footer-hint { font-size: 10px; color: #999; border-top: 1px solid #e0e0e0; padding-top: 4px; margin-top: 2px; }
        .sul-footer-tag { background: #2a7ad4; color: #fff; padding: 1px 6px; border-radius: 3px; font-size: 11px; }
        .sul-footer-existing-tag { background: #c77600; }
        .sul-footer-partial-tag { background: #c77600; opacity: 0.6; }
      `;
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
      footerTags.textContent = "—";
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

      const existingCodes = io.existingCodes instanceof Set ? io.existingCodes : new Set(io.existingCodes || []);
      const partialCodes = io.partialCodes instanceof Set ? io.partialCodes : new Set(io.partialCodes || []);
      const selected = new Set();
      const freeTextSelected = new Set();
      let visible = [];
      let activeIdx = 0;

      function updateTitle() {
        const n = selected.size + freeTextSelected.size;
        doc.title = n > 0 ? `${baseTitle} (${n} ausgewählt)` : baseTitle;
      }

      function toggleEntry(entry, resetFilter) {
        if (entry.freeTextCandidate) {
          const text = filter.value.trim();
          if (text) {
            freeTextSelected.add(text);
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
        if (selected.has(entry.code)) {
          selected.delete(entry.code);
        } else {
          selected.add(entry.code);
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

      function updateFooter() {
        const container = doc.getElementById("sul-footer-tags");
        container.replaceChildren();
        if (selected.size === 0 && freeTextSelected.size === 0) {
          container.textContent = "—";
        } else {
          allEntries.filter(e => selected.has(e.code)).forEach(e => {
            const chip = doc.createElement("span");
            chip.className = "sul-footer-tag";
            chip.textContent = e.code;
            container.appendChild(chip);
          });
          freeTextSelected.forEach(text => {
            const chip = doc.createElement("span");
            chip.className = "sul-footer-tag";
            chip.textContent = text;
            container.appendChild(chip);
          });
        }
        const existingRowEl = doc.getElementById("sul-footer-existing");
        const existingContainer = doc.getElementById("sul-footer-existing-tags");
        existingContainer.replaceChildren();
        if (existingCodes.size > 0) {
          existingRowEl.style.display = "";
          allEntries.filter(e => existingCodes.has(e.code)).forEach(e => {
            const chip = doc.createElement("span");
            chip.className = "sul-footer-tag sul-footer-existing-tag";
            chip.textContent = e.code;
            existingContainer.appendChild(chip);
          });
        } else {
          existingRowEl.style.display = "none";
        }
        const partialRowEl = doc.getElementById("sul-footer-partial");
        const partialContainer = doc.getElementById("sul-footer-partial-tags");
        partialContainer.replaceChildren();
        if (partialCodes.size > 0) {
          partialRowEl.style.display = "";
          allEntries.filter(e => partialCodes.has(e.code)).forEach(e => {
            const chip = doc.createElement("span");
            chip.className = "sul-footer-tag sul-footer-partial-tag";
            chip.textContent = e.code;
            partialContainer.appendChild(chip);
          });
        } else {
          partialRowEl.style.display = "none";
        }
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
            if (selected.has(entry.code)) {
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
              try { Zotero.debug(`[SUL picker] click: ${entry.code}`); } catch (e) {}
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
        try { Zotero.debug(`[SUL picker] keydown: ${e.key} ctrl=${e.ctrlKey}`); } catch (e2) {}
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive(activeIdx + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive(activeIdx - 1);
        } else if (e.key === "Enter" && e.ctrlKey) {
          e.preventDefault();
          if (selected.size === 0 && freeTextSelected.size === 0) return;
          const result = [
            ...allEntries.filter(e => selected.has(e.code)),
            ...[...freeTextSelected].map(t => ({ code: t, freeText: true })),
          ];
          if (typeof SUL.picker._currentResolve === "function") {
            SUL.picker._currentResolve(result);
          }
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
          if (typeof SUL.picker._currentResolve === "function") {
            SUL.picker._currentResolve(null);
          }
          try { dialog.close(); } catch (err) {}
        }
      });

      render();
      updateFooter();
      filter.focus();
    },
  },

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  // DDC PICKER
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////

  ddcPicker: {
    groups: [
      {
        label: "000 – Allgemeines",
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
        ],
      },
      {
        label: "100 – Philosophie",
        entries: [
          { code: "100", label: "Philosophie" },
          { code: "130", label: "Parapsychologie, Okkultismus" },
          { code: "150", label: "Psychologie" },
        ],
      },
      {
        label: "200 – Religion",
        entries: [
          { code: "200", label: "Religion, Religionsphilosophie" },
          { code: "220", label: "Bibel" },
          { code: "230", label: "Theologie, Christentum" },
          { code: "290", label: "Andere Religionen" },
        ],
      },
      {
        label: "300 – Sozialwissenschaften",
        entries: [
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
        ],
      },
      {
        label: "400 – Sprache",
        entries: [
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
        ],
      },
      {
        label: "500 – Naturwissenschaften",
        entries: [
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
        ],
      },
      {
        label: "600 – Technik",
        entries: [
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
        ],
      },
      {
        label: "700 – Künste",
        entries: [
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
        ],
      },
      {
        label: "800 – Literatur",
        entries: [
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
        ],
      },
      {
        label: "900 – Geschichte",
        entries: [
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
        ],
      },
      {
        label: "Sonstige",
        entries: [
          { code: "B", label: "Belletristik", hint: "nur zusätzlich zu 800-890" },
          { code: "K", label: "Kinder- und Jugendliteratur" },
          { code: "S", label: "Schulbücher" },
        ],
      },
    ],

    async pickAndApply() {
      const ZoteroPane = Zotero.getActiveZoteroPane();
      const items = ZoteroPane.getSelectedItems();
      if (!items.length) {
        SUL.log("ddcPicker: no items selected");
        return;
      }
      const allHaveCodes = new Set();
      const someHaveCodes = new Set();
      if (items.length === 1) {
        items[0].getTags().forEach((t) => {
          if (t.tag.startsWith("DDC")) {
            allHaveCodes.add(t.tag.replace("DDC ", ""));
          }
        });
      } else {
        const perItem = items.map((item) =>
          new Set(item.getTags().filter((t) => t.tag.startsWith("DDC")).map((t) => t.tag.replace("DDC ", "")))
        );
        const allCodes = new Set(perItem.flatMap((s) => [...s]));
        allCodes.forEach((code) => {
          const count = perItem.filter((s) => s.has(code)).length;
          if (count === items.length) {
            allHaveCodes.add(code);
          } else {
            someHaveCodes.add(code);
          }
        });
      }
      const title = items.length === 1 ? "DDC-Tag wählen" : `DDC-Tag wählen (${items.length} Titel)`;
      const choices = await SUL.picker.show({
        title,
        groups: SUL.ddcPicker.groups,
        existingCodes: allHaveCodes,
        partialCodes: someHaveCodes,
        itemCount: items.length,
      });
      if (!choices) {
        SUL.log("ddcPicker: cancelled");
        return;
      }
      const tags = choices.map((e) => `DDC ${e.code}`);
      await Zotero.DB.executeTransaction(async () => {
        for (const item of items) {
          for (const tag of tags) {
            item.addTag(tag, 0);
          }
          await item.save();
        }
      });
      SUL.log(`ddcPicker: added ${tags.join(", ")} to ${items.length} item(s)`);
    },
  },

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  // BC PICKER
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////

  bcPicker: {
    groups: [
      {
        label: "Print / Verfügbarkeit",
        entries: [
          { code: "MEX",  label: "Auch wenn eBook oder Print in Kurierbibl. vorhanden" },
          { code: "MEXo", label: "Auch wenn eBook vorhanden" },
          { code: "MEXp", label: "Auch wenn Print in Kurierbibl. vorhanden" },
          { code: "UBE",  label: "Nur wenn nirgends in UB Bern vorhanden" },
          { code: "SLSP", label: "Nur wenn schweizweit in keiner SLSP-Bibl. ausleihbar" },
        ],
      },
      {
        label: "E-Book",
        entries: [
          { code: "E1",   label: "1-user" },
          { code: "E1p",  label: "1-user, auch wenn Print vorhanden" },
          { code: "E1s",  label: "1-user + NZ-Katalogisat" },
          { code: "E1ps", label: "1-user, auch wenn Print + NZ-Katalogisat" },
          { code: "E3",   label: "3-user" },
          { code: "E3p",  label: "3-user, auch wenn Print vorhanden" },
          { code: "E3s",  label: "3-user + NZ-Katalogisat" },
          { code: "E3ps", label: "3-user, auch wenn Print + NZ-Katalogisat" },
          { code: "E+",   label: "Unlimited" },
          { code: "E+p",  label: "Unlimited, auch wenn Print vorhanden" },
          { code: "E+s",  label: "Unlimited + NZ-Katalogisat" },
          { code: "E+ps", label: "Unlimited, auch wenn Print + NZ-Katalogisat" },
          { code: "OA",   label: "OA-Katalogisat erstellen (keine Erwerbung)" },
        ],
      },
      {
        label: "Bernensia",
        entries: [
          { code: "Ausleihe",                label: "1 Exemplar: Ausleihe (UB-Speicher)" },
          { code: "Ausleihe+Archiv",         label: "2 Exemplare: Ausleihe + Archiv (BMü-Sonderlesesaal)" },
          { code: "Ausleihe+Archiv+Ansicht", label: "3 Exemplare: Ausleihe + Archiv + Ansicht (Bernensia-Bibl.)" },
          { code: "bb",                      label: "Berner Belletristik" },
        ],
      },
    ],

    async pickAndApply() {
      const ZoteroPane = Zotero.getActiveZoteroPane();
      const items = ZoteroPane.getSelectedItems();
      if (!items.length) {
        SUL.log("bcPicker: no items selected");
        return;
      }
      const allHaveCodes = new Set();
      const someHaveCodes = new Set();
      if (items.length === 1) {
        items[0].getTags().forEach(t => {
          if (t.tag.startsWith("BC ")) allHaveCodes.add(t.tag.substring(3));
        });
      } else {
        const perItem = items.map(item =>
          new Set(item.getTags().filter(t => t.tag.startsWith("BC ")).map(t => t.tag.substring(3)))
        );
        const allCodes = new Set(perItem.flatMap(s => [...s]));
        allCodes.forEach(code => {
          const count = perItem.filter(s => s.has(code)).length;
          if (count === items.length) {
            allHaveCodes.add(code);
          } else {
            someHaveCodes.add(code);
          }
        });
      }
      const title = items.length === 1 ? "Bestellcode wählen" : `Bestellcode wählen (${items.length} Titel)`;
      const choices = await SUL.picker.show({
        title,
        groups: SUL.bcPicker.groups,
        allowFreeText: true,
        existingCodes: allHaveCodes,
        partialCodes: someHaveCodes,
        itemCount: items.length,
      });
      if (!choices) {
        SUL.log("bcPicker: cancelled");
        return;
      }
      const tags = choices.map(e => `BC ${e.code}`);
      await Zotero.DB.executeTransaction(async () => {
        for (const item of items) {
          for (const tag of tags) {
            item.addTag(tag, 0);
          }
          await item.save();
        }
      });
      SUL.log(`bcPicker: added ${tags.join(", ")} to ${items.length} item(s)`);
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
