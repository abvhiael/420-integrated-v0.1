import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const required = [
  'index.html',
  'app.js',
  'styles.css',
  'package.json',
  'runtime-config.json',
  'runtime-config.example.json',
  'core/config.js',
  'core/router.js',
  'core/design-system.js',
  'test/config.test.js',
  'test/router.test.js',
  'test/design-system.test.js',
  'v14.1-qualification.json',
  'v14.2-qualification.json',
];

for (const relative of required) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) throw new Error(`missing required Exchange web file: ${relative}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (packageJson.name !== '@420integrated/exchange-web') throw new Error('unexpected Exchange package name');

const config = JSON.parse(fs.readFileSync(path.join(root, 'runtime-config.json'), 'utf8'));
if (config.site?.productionOrigin !== 'https://exchange.420integrated.org') {
  throw new Error('production origin drift');
}
if (config.api?.schemaMajor !== 14 || config.api?.schemaMinor !== 0) {
  throw new Error('V14 client schema drift');
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const needle of ['420Exchange', 'app-view', 'app.js', 'status-gallery', 'exchange-table']) {
  if (!html.includes(needle)) throw new Error(`application shell missing marker: ${needle}`);
}

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
if (!app.includes("fetch('./runtime-config.json'")) {
  throw new Error('application does not load runtime-config.json');
}
if (!app.includes('validateRuntimeConfig')) {
  throw new Error('application does not validate runtime configuration');
}
if (!app.includes('createStatusBadge')) {
  throw new Error('application does not consume shared V14.2 semantic status components');
}

const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
for (const needle of ['--positive:', '--warning:', '--info:', '--danger:', ':focus-visible', '.exchange-status', '.exchange-table']) {
  if (!styles.includes(needle)) throw new Error(`design system missing token or primitive: ${needle}`);
}

console.log('420Exchange V14.1/V14.2 static qualification passed');
