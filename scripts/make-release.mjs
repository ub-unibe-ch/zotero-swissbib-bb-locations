import { readFileSync } from "fs";
import { execSync } from "child_process";

// Parse flags
const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");

// Wrapper for execSync that supports dry-run mode
const exec = (cmd, options = {}) => {
  if (dryRun) {
    console.log(`[dry-run] ${cmd}`);
    return;
  }
  execSync(cmd, options);
};

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = pkg.version;
const xpiName = `zotero-swisscovery-ubbern-locations-${version}.xpi`;
const xpiPath = `.scaffold/build/${xpiName}`;
const tag = `v${version}`;

// Check gh auth
try {
  exec("gh auth status", { stdio: "pipe" });
} catch (e) {
  console.error("❌ GitHub CLI not authenticated. Run: gh auth login");
  process.exit(1);
}

const modeIndicator = dryRun ? " (dry-run mode)" : force ? " (force mode)" : "";
console.log(`\n📦 Making release ${version}${modeIndicator}\n`);

// Check if tag already exists locally
try {
  exec(`git tag -l ${tag}`, { stdio: "pipe" });
  if (force) {
    console.log(`→ Tag ${tag} exists, deleting...`);
    exec(`git tag -d ${tag}`, { stdio: "pipe" });
    try {
      exec(`git push origin :refs/tags/${tag}`, { stdio: "pipe" });
    } catch (e) {
      // Tag not on remote, continue
    }
  } else {
    console.error(`❌ Tag ${tag} already exists. Use --force to override, or bump version first with: pnpm run bump`);
    process.exit(1);
  }
} catch (e) {
  // Tag doesn't exist, continue
}

// Build
console.log("→ Building...");
exec("pnpm run build", { stdio: "inherit" });

// Create and push tag
console.log("→ Creating git tag...");
exec(`git tag ${tag}`, { stdio: "pipe" });
exec(`git push --tags --force`, { stdio: "pipe" });

// Create GitHub release with XPI
console.log("→ Creating GitHub release...");
try {
  exec(`gh release view ${tag}`, { stdio: "pipe" });
  if (force) {
    console.log(`→ Release ${tag} exists, deleting...`);
    exec(`gh release delete ${tag} --yes`, { stdio: "inherit" });
  } else {
    console.error(`❌ GitHub release ${tag} already exists. Use --force to override`);
    process.exit(1);
  }
} catch (e) {
  // Release doesn't exist, continue
}

exec(
  `gh release create ${tag} ${xpiPath} --title "${tag}" --notes "See CHANGES.md"`,
  { stdio: "inherit" }
);

const successMsg = dryRun
  ? `\n✅ Dry-run complete! No changes were made.\n`
  : `\n✅ Release ${version} created! Run 'pnpm run publish' to upload update.json\n`;
console.log(successMsg);
