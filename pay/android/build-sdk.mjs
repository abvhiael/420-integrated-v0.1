import { build } from '../web/node_modules/esbuild/lib/main.js';

await build({
  entryPoints: ['web/sdk.js'], bundle: true, format: 'iife',
  target: 'chrome100', outfile: process.argv[2]
});
