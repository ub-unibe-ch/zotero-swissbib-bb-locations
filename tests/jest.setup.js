// Parse prefs.js to extract default values for Jest test runs.
// Support the primitive preference value types accepted by Zotero/Firefox
// and fail fast on unsupported pref declarations to avoid silently running
// tests with incomplete defaults.
const fs = require("fs");
const prefsContent = fs.readFileSync("addon/prefs.js", "utf-8");
const prefDefaults = {};
const prefLineRegex =
  /^\s*pref\("([^"]+)",\s*(?:"([^"]*)"|(true|false)|(-?\d+(?:\.\d+)?))\s*\);\s*$/;

for (const line of prefsContent.split(/\r?\n/)) {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine.startsWith("//")) {
    continue;
  }

  const match = trimmedLine.match(prefLineRegex);
  if (match) {
    const [, key, stringValue, booleanValue, numberValue] = match;

    if (stringValue !== undefined) {
      prefDefaults[key] = stringValue;
    } else if (booleanValue !== undefined) {
      prefDefaults[key] = booleanValue === "true";
    } else if (numberValue !== undefined) {
      prefDefaults[key] = Number(numberValue);
    }

    continue;
  }

  if (trimmedLine.startsWith('pref("')) {
    throw new Error(`Unsupported preference declaration in addon/prefs.js: ${trimmedLine}`);
  }
}
globalThis.__PREF_DEFAULTS__ = prefDefaults;
