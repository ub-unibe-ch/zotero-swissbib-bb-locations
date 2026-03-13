# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

- `npm start` - Start development server with hot reload (`zotero-plugin serve`)
- `npm run build` - Build the plugin to `.scaffold/build/addon/`
- `npm run release` - Create a release build
- `npm test` - Run Jest tests

## Architecture Overview

### Critical: Global Export Requirement

The `bundle: true` setting in `zotero-plugin.config.ts` wraps code in an IIFE. **Any code that needs to be globally accessible must be explicitly exported:**

```javascript
// At the end of src/swisscoveryubbernlocations.js:
if (typeof window !== 'undefined') {
  window.SUL = SUL;  // Required for Zotero
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SUL;  // Required for Jest tests
}
```

Without this, `bootstrap.js` cannot access `SUL` after loading the script.

### Bootstrap Pattern

1. **bootstrap.js** loads on Zotero startup:
   - Registers preference pane
   - Loads main script via `Services.scriptloader.loadSubScript()`
   - Calls `SUL.init()` and `SUL.addToAllWindows()`

2. **Main script (`src/swisscoveryubbernlocations.js`)** defines the `SUL` namespace object containing:
   - Plugin metadata and configuration
   - UI management (`addToWindow`, `createMenuItem`, `removeFromWindow`)
   - Feature modules: `locationLookup`, `orderNote`, `helpers`

3. **Menu creation** happens dynamically in `addToWindow()`:
   - Creates submenu under `zotero-itemmenu`
   - Uses Fluent localization with `insertFTLIfNeeded()`
   - Binds menu items to: `locationLookup.LocationLookup()` and `orderNote.addOrderNote()`

### Two Main Functions

**Location Lookup**: Queries Swisscovery UB Bern SRU interface, processes print/electronic holdings, applies status tags, updates target field with holdings info.

**Order Note**: Extracts tags (DDC*, BC*, ETAT*), constructs order note format "budget // DDCs // order codes", updates volume field.

### Build Output Structure

```
.scaffold/build/addon/
├── bootstrap.js           # Copied from addon/
├── swisscoveryubbernlocations.js  # Bundled from src/
├── manifest.json          # With placeholders replaced
├── prefs.js
├── content/               # Preferences, icons
└── locale/                # Fluent localization files
```

## Key Configuration

Preferences are stored under `extensions.zotero.swisscoveryubbernlocations.` prefix:
- `sruurl` - SRU endpoint URL
- `apikey` - ALMA API key for loan conditions
- `targetField` - Field for holdings output (default: extra/abstract)

## Release Workflow

Simplified release process with GitHub Actions:

1. **Development**: Work in feature branch, bump version with `pnpm run bump`
2. **PR & Merge**: Create pull request, merge to master branch
3. **Tag & Release**:
   ```bash
   git checkout master && git pull
   pnpm run tag          # Creates tag v{version} and pushes to GitHub
   ```

The GitHub Actions workflow (triggered by tag `v*`) handles:
- Build execution
- GitHub release `v{version}` with XPI asset
- Upload of `update.json` to `release` tag for auto-updates

**Tag script options:**
- `pnpm run tag:dry` - Preview without making changes
- `pnpm run tag:force` - Overwrite existing tag

**Legacy local release scripts** (backup, use only if CI fails):
- `pnpm run make-local-release` - Full local release (tag + build + GitHub release)
- `pnpm run publish` - Upload update.json only

**Prerequisites for local scripts**:
- GitHub CLI authenticated (`gh auth login`)
