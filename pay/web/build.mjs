import { copyFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('dist', { recursive: true });
await Promise.all([
  ...['index.html', 'checkout-embed.html', 'style.css', 'deployment.json'].map(file => copyFile(file, 'dist/' + file)),
  build({ entryPoints: ['app.js', 'checkout-embed.js'], outdir: 'dist', bundle: true, format: 'esm', target: 'es2022' })
]);
