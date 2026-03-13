#!/usr/bin/env node
import fs from 'fs';
import readline from 'readline';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const force = args.includes('--force');
const skipChangelog = args.includes('--skip-changelog');
const dryRun = args.includes('--dry-run') || args.includes('-n');
const autoYes = args.includes('--yes') || args.includes('-y');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: tag-and-push [options]

Options:
  --force          Delete and recreate existing tag (local + remote)
  --skip-changelog Skip changelog check
  --dry-run, -n    Show what would happen without doing it
  --yes, -y        Auto-confirm without prompt
  --help, -h       Show this help

Example:
  node scripts/tag-and-push.mjs --dry-run
  node scripts/tag-and-push.mjs --force --yes
  node scripts/tag-and-push.mjs --skip-changelog
  `);
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const version = pkg.version;
const tag = `v${version}`;

console.log(`\n📦 Version: ${version}`);
console.log(`🏷️  Tag: ${tag}`);
if (dryRun) console.log(`\n⚠️  DRY RUN - no changes will be made\n`);

// Verify we're on master branch
const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
if (currentBranch !== 'master') {
  console.error(`❌ You are on branch "${currentBranch}", not "master".`);
  console.error(`   Tags should only be created from master to ensure releases are stable.\n`);
  process.exit(1);
}
console.log(`✅ On master branch\n`);

// Check if tag already exists (only error if not --force)
let localExists = false;
let remoteExists = false;

try {
  const existing = execSync(`git tag -l ${tag}`, { encoding: 'utf-8' });
  localExists = !!existing.trim();
} catch {
  // Ignore error
}

try {
  const remoteTag = execSync(`git ls-remote --tags origin refs/tags/${tag}`, { encoding: 'utf-8' });
  remoteExists = !!remoteTag.trim();
} catch {
  // Ignore error
}

if (localExists && remoteExists && !force) {
  console.error(`❌ Tag ${tag} exists locally and on remote. Use --force to overwrite.\n`);
  process.exit(1);
}

if (remoteExists && !localExists && !force) {
  console.error(`❌ Tag ${tag} exists on remote but not locally. Use --force to overwrite.\n`);
  process.exit(1);
}

if (localExists && !remoteExists && !force) {
  console.error(`❌ Tag ${tag} exists locally but not on remote. Use --force to overwrite.\n`);
  process.exit(1);
}

if ((localExists || remoteExists) && force) {
  console.log(`⚠️  Tag ${tag} exists - will overwrite\n`);
}

// Check CHANGES.md for version entry (unless --skip-changelog)
if (!skipChangelog) {
  const changesPath = 'CHANGES.md';
  const changes = fs.readFileSync(changesPath, 'utf-8');

  // Strict regex match: line must start with ## followed by optional v, then exact version
  const versionRegex = new RegExp(`^##\\s+v?\\b${version.replace(/\./g, '\\.')}\\b`, 'm');
  if (!versionRegex.test(changes)) {
    console.error(`❌ No entry for ${tag} found in ${changesPath}`);
    console.error(`   Please add a changelog entry first (or use --skip-changelog):\n`);
    console.error(`   ## ${tag}\n`);
    console.error(`   - Your changes here\n`);
    process.exit(1);
  }
  console.log(`✅ Changelog entry found\n`);
}

async function askUser() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`Create and push tag ${tag}? [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  const proceed = autoYes || await askUser();

  if (!proceed) {
    console.log('\n❌ Cancelled\n');
    process.exit(0);
  }

  try {
    const tagCmd = force ? `git tag -f -a ${tag} -m "Release ${tag}"` : `git tag -a ${tag} -m "Release ${tag}"`;
    const pushCmd = force ? `git push origin ${tag} --force` : `git push origin ${tag}`;

    function runOrLog(label, cmd, indent = false) {
      if (dryRun) {
        console.log(`  ${label}`);
        if (indent) console.log(`    ${cmd}`);
      } else {
        console.log(`${label}`);
        execSync(cmd, { stdio: 'inherit' });
      }
      if (dryRun) console.log();  // newline between steps in dry-run
    }

    if (dryRun) {
      console.log(`Would execute:\n`);
    }

    runOrLog(`[1/2] Create tag:`, tagCmd, dryRun);
    if (!dryRun) console.log(`✅ Tag ${tag} created\n`);

    runOrLog(`[2/2] Push to remote:`, pushCmd, dryRun);
    if (!dryRun) {
      console.log(`✅ Tag ${tag} pushed - CI will release now\n`);
    } else {
      console.log(`\n✅ Dry run complete - no changes made\n`);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();
