import fs from 'node:fs';
import path from 'node:path';
import { loadDeploymentManifest, toBrowserConfig } from './deployment-manifest.mjs';

const manifestPath = process.env.DICE_DEPLOYMENT_MANIFEST ?? process.argv[2];
const { manifest, resolved } = loadDeploymentManifest(manifestPath);
const config = toBrowserConfig(manifest);

function serialize(value) {
  return JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? `${item}n` : item, 2)
    .replace(/"(\d+)n"/g, '$1n');
}

const outputPath = path.resolve('public/config.js');
fs.writeFileSync(outputPath, `// Generated from ${resolved}. Do not hand-edit.\nwindow.__420_DICE_CONFIG__ = ${serialize(config)};\n`);
console.log(`wrote ${outputPath}`);
