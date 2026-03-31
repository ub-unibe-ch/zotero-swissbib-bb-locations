const fs = require("fs");
const prefsContent = fs.readFileSync("addon/prefs.js", "utf-8");
const prefDefaults = {};
for (const m of prefsContent.matchAll(/pref\("(\w+)",\s*"([^"]*)"\)/g)) {
  prefDefaults[m[1]] = m[2];
}
globalThis.__PREF_DEFAULTS__ = prefDefaults;
