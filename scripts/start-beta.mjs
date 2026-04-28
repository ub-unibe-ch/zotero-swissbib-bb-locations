#!/usr/bin/env node
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';

const envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  console.error('.env not found. Copy .env.example to .env and fill in the paths.');
  process.exit(1);
}

const envVars = {};
const lineRegex = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(.*?))\s*$/;
for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
  if (!line || line.trim().startsWith('#')) continue;
  const m = line.match(lineRegex);
  if (!m) continue;
  envVars[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
}

const betaBin = envVars.ZOTERO_PLUGIN_ZOTERO_BIN_PATH_BETA;
const betaProfile = envVars.ZOTERO_PLUGIN_PROFILE_PATH_BETA;

if (!betaBin || !betaProfile) {
  console.error(
    'Missing ZOTERO_PLUGIN_ZOTERO_BIN_PATH_BETA or ZOTERO_PLUGIN_PROFILE_PATH_BETA in .env.\n' +
      'See .env.example for the expected entries.',
  );
  process.exit(1);
}

process.env.ZOTERO_PLUGIN_ZOTERO_BIN_PATH = betaBin;
process.env.ZOTERO_PLUGIN_PROFILE_PATH = betaProfile;

console.log(`Starting Zotero Beta from: ${betaBin}`);
console.log(`Profile: ${betaProfile}`);

const isWin = process.platform === 'win32';
const cmd = isWin ? 'zotero-plugin.cmd' : 'zotero-plugin';
const child = spawn(cmd, ['serve'], { stdio: 'inherit', env: process.env, shell: isWin });
child.on('exit', (code) => process.exit(code ?? 0));
