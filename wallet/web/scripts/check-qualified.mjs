import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const scriptsDir = path.dirname(new URL(import.meta.url).pathname);
const sourcePath = path.join(scriptsDir, 'check.mjs');
let source = fs.readFileSync(sourcePath, 'utf8');

const oldPolicy = "if (config.features?.passkeys !== false) errors.push('passkeys must remain disabled until their dedicated milestone qualifies');";
const newPolicy = "if (config.features?.passkeys !== true) errors.push('qualified passkey runtime must remain enabled');";
if (!source.includes(oldPolicy)) throw new Error('wallet qualification guard passkey policy anchor changed');
source = source.replace(oldPolicy, newPolicy);

const oldOutput = '  passkeysEnabled: false,';
const newOutput = '  passkeysEnabled: true,';
if (!source.includes(oldOutput)) throw new Error('wallet qualification guard passkey output anchor changed');
source = source.replace(oldOutput, newOutput);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-check-qualified-'));
const tempPath = path.join(tempDir, 'check-qualified-runtime.mjs');
source = source.replace(
  "const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');",
  `const root = ${JSON.stringify(path.resolve(scriptsDir, '..'))};`,
);
fs.writeFileSync(tempPath, source);
try {
  await import(pathToFileURL(tempPath).href);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
