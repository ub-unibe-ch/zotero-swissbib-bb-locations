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

Manual, controlled release process with GitHub PRs and auto-updates via `update.json`:

1. **Development**: Work in feature branch, update `package.json` version
2. **PR & Merge**: Create pull request, merge to main branch
3. **Release locally**:
   ```bash
   git checkout main && git pull
   pnpm run make-release  # Tag + Build + GitHub Release (XPI)
   pnpm run publish       # update.json für Auto-Updates
   ```

The `make-release` script handles:
- Git tag creation (`v{version}`) and push
- Build execution
- GitHub release `v{version}` with XPI asset

The `publish` script uploads `update.json` to the `release` GitHub release for auto-updates.

**Optional**: Use `pnpm run bump [patch|minor|major]` in the feature branch before merging to increment version automatically.

**Prerequisites**:
- No uncommitted changes
- GitHub CLI authenticated (`gh auth login`)
