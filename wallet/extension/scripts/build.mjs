import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const walletRoot = resolve(extensionRoot, '..');
const dist = join(extensionRoot, 'dist');
const sourceFiles = [
  'manifest.json',
  'service-worker.js',
  'content-script.js',
  'inpage.js',
  'popup.html',
  'popup.js',
  'popup.css',
  'authority.html',
  'authority.js',
];

export async function buildExtension420() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  for (const file of sourceFiles) await cp(join(extensionRoot, file), join(dist, file));
  await cp(join(walletRoot, 'web', 'core'), join(dist, 'core'), { recursive: true });
  return { dist, files: await readdir(dist) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildExtension420();
  console.log(`420 Wallet extension build complete: ${result.dist}`);
}
