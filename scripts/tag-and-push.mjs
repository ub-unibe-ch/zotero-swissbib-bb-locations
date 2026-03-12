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

// Check if tag already exists (only error if not --force)
try {
  const existing = execSync(`git tag -l ${tag}`, { encoding: 'utf-8' });
  if (existing.trim() && !force) {
    console.error(`❌ Tag ${tag} already exists locally. Use --force to overwrite.\n`);
    process.exit(1);
  }
  if (existing.trim() && force) {
    console.log(`⚠️  Tag ${tag} exists - will delete and recreate\n`);
  }
} catch {
  // Ignore error
}

// Check CHANGES.md for version entry (unless --skip-changelog)
if (!skipChangelog) {
  const changesPath = 'CHANGES.md';
  const changes = fs.readFileSync(changesPath, 'utf-8');

  if (!changes.includes(`## ${tag}`) && !changes.includes(`## ${version}`)) {
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
    if (dryRun) {
      console.log(`Would execute:`);
      if (force) {
        console.log(`  git tag -f -a ${tag} -m "Release ${tag}"`);
        console.log(`  git push origin ${tag} --force`);
      } else {
        console.log(`  git tag -a ${tag} -m "Release ${tag}"`);
        console.log(`  git push origin ${tag}`);
      }
    } else {
      const tagCmd = force ? `git tag -f -a ${tag} -m "Release ${tag}"` : `git tag -a ${tag} -m "Release ${tag}"`;
      const pushCmd = force ? `git push origin ${tag} --force` : `git push origin ${tag}`;

      execSync(tagCmd, { stdio: 'inherit' });
      console.log(`\n✅ Tag ${tag} created`);
      execSync(pushCmd, { stdio: 'inherit' });
      console.log(`✅ Tag ${tag} pushed - CI will release now\n`);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();
