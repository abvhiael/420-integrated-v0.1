import { copyFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const assets = new URL('./Generated/', import.meta.url);
await mkdir(assets, { recursive: true });
execFileSync(process.execPath, ['build-sdk.mjs', fileURLToPath(new URL('sdk.js', assets))], {
  cwd: fileURLToPath(new URL('../android/', import.meta.url)), stdio: 'inherit'
});
await copyFile(new URL('../android/app/src/main/assets/review.html', import.meta.url), new URL('review.html', assets));
