import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const icons = ['icons/pay-192.png', 'icons/pay-512.png'];
const shell = ['index.html', 'app.js', '420id-client.mjs', 'style.css', 'manifest.webmanifest', ...icons];
await mkdir('dist/icons', { recursive: true });
await Promise.all([
  ...['index.html', 'checkout-embed.html', '420id-client.mjs', 'style.css', 'deployment.json', 'manifest.webmanifest', ...icons]
    .map(file => copyFile(file, 'dist/' + file)),
  build({ entryPoints: ['app.js', 'checkout-embed.js'], outdir: 'dist', bundle: true, format: 'esm', target: 'es2022' })
]);
const worker = await readFile('service-worker.js', 'utf8');
const revision = createHash('sha256').update(worker);
for (const file of shell) revision.update(await readFile('dist/' + file));
await writeFile('dist/service-worker.js', worker.replace('__PAY_SHELL_REVISION__', revision.digest('hex')));
