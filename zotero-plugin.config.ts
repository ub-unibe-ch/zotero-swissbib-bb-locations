import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";
import { fse } from "zotero-plugin-scaffold/vendor";
import { execSync } from "child_process";
import fs from "fs";



// Parse prefs.js to extract default values for build-time injection
const prefsContent = fs.readFileSync("addon/prefs.js", "utf-8");
const prefDefaults: Record<string, string> = {};
for (const m of prefsContent.matchAll(/pref\("(\w+)",\s*"([^"]*)"\)/g)) {
  prefDefaults[m[1]] = m[2];
}

export default defineConfig({
  dist: ".scaffold/build",
  source: ["src", "addon"],

  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,

  xpiName: `zotero-swisscovery-ubbern-locations-${pkg.version}`,

  updateURL: `https://github.com/ub-unibe-ch/zotero-swissbib-bb-locations/releases/download/release/update.json`,
  xpiDownloadLink: `https://github.com/ub-unibe-ch/zotero-swissbib-bb-locations/releases/download/v{{version}}/zotero-swisscovery-ubbern-locations-{{version}}.xpi`,

  release: {
    hooks: {
      "release:init": async (ctx) => {
        // Check for uncommitted changes
        try {
          execSync("git diff-index --quiet HEAD --", { stdio: "pipe" });
        } catch (e) {
          throw new Error("Uncommitted changes found. Commit all changes before release.");
        }
      },
      "release:done": async (ctx) => {
        // Check CHANGES.md for version entry (warning only)
        const version = ctx.version;
        const changes = fs.readFileSync("CHANGES.md", "utf-8");

        if (!changes.includes(`## v${version}`) && !changes.includes(`## ${version}`)) {
          console.warn(`\n⚠️  Warning: CHANGES.md has no entry for version ${version}\n`);
        }
      },
    },
  },

  build: {
    assets: ["addon"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },

    fluent: {
      prefixLocaleFiles: true,
      prefixFluentMessages: true,
    },


    esbuildOptions: [
      {
        entryPoints: ["src/swisscoveryubbernlocations.js"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
          __PREF_DEFAULTS__: JSON.stringify(prefDefaults),
        },
        bundle: true,
        target: "firefox115",
        outfile: `.scaffold/build/addon/swisscoveryubbernlocations.js`,
      },
    ],
  },
});