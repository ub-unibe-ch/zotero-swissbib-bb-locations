import { readFileSync } from "fs";
import { execSync } from "child_process";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = pkg.version;
const updateJsonPath = `.scaffold/build/update.json`;

// Check gh auth
try {
  execSync("gh auth status", { stdio: "pipe" });
} catch (e) {
  console.error("❌ GitHub CLI not authenticated. Run: gh auth login");
  process.exit(1);
}

console.log(`\n📤 Publishing update.json for version ${version}\n`);

try {
  execSync(
    `gh release upload release ${updateJsonPath} --clobber`,
    { stdio: "inherit" }
  );
  console.log("✅ update.json uploaded to 'release'");
} catch (e) {
  execSync(
    `gh release create release ${updateJsonPath} --title "release" --notes "Auto-update manifest"`,
    { stdio: "inherit" }
  );
  console.log("✅ Created 'release' with update.json");
}

console.log(`\n✅ Auto-update manifest published!\n`);
