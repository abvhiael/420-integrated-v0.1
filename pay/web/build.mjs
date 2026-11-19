import { copyFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('dist', { recursive: true });
await Promise.all([
  ...['index.html', 'style.css', 'deployment.json'].map(file => copyFile(file, 'dist/' + file)),
  build({ entryPoints: ['app.js'], outfile: 'dist/app.js', bundle: true, format: 'esm', target: 'es2022' })
]);
