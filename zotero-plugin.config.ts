import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";
import { fse } from "zotero-plugin-scaffold/vendor";
import { execSync } from "child_process";
import fs from "fs";



export default defineConfig({
  dist: ".scaffold/build",
  source: ["src", "addon"],

  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,

  xpiName: `zotero-swisscovery-ubbern-locations-${pkg.version}`,

  updateURL: `https://github.com/ub-unibe-ch/zotero-swissbib-bb-locations/releases/download/v{{version}}/update.json`,
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
    hooks: {
      "build:done": async (ctx) => {
        // Copy update.json to root directory (only in production)
        if (process.env.NODE_ENV === "production") {
          await fse.copy(
            `.scaffold/build/update.json`,
            `update.json`
          );
        }
      },
    },
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
        },
        bundle: true,
        target: "firefox115",
        outfile: `.scaffold/build/addon/swisscoveryubbernlocations.js`,
      },
    ],
  },
});