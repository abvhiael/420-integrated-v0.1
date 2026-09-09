import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const manifest = JSON.parse(read('design/brand-assets.json'));
const ios = JSON.parse(read('ios/AppIcon420.asset-manifest.json'));

const required = [
  manifest.masterIcon,
  manifest.wordmark,
  ...manifest.illustrations,
  'android/app/src/main/res/drawable/ic_wallet420_foreground.xml',
  'android/app/src/main/res/drawable/ic_wallet420_legacy.xml',
  'android/app/src/main/res/mipmap-anydpi/ic_launcher.xml',
  'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
  'android/app/src/main/res/values/colors.xml',
  'ios/AppIcon420.asset-manifest.json',
];
for (const file of required) if (!exists(file)) throw new Error(`missing W13.5 asset: ${file}`);
if (manifest.authority !== 'presentation-only') throw new Error('assets must remain presentation-only');
if (manifest.palette.blue !== '#273B9C' || manifest.palette.green !== '#45B84A') throw new Error('canonical logo colors drifted');
if (manifest.android.adaptiveIcon.background !== '#FFFFFF') throw new Error('Android icon background drifted');
if (!manifest.ios.appIconSizesPx.includes(1024) || ios.outputs.at(-1)?.pixels !== 1024) throw new Error('missing iOS marketing icon contract');

const sources = required.filter((p) => p.endsWith('.svg') || p.endsWith('.xml')).map(read).join('\n');
if (!/#273B9C/.test(sources) || !/#45B84A/.test(sources)) throw new Error('canonical blue/green mark missing');
if (/0x[a-fA-F0-9]{40}|[a-fA-F0-9]{64}|private\s*key|seed\s*phrase|mnemonic/i.test(sources)) throw new Error('asset source may contain wallet/user secret-like data');

const androidManifest = read('android/app/src/main/AndroidManifest.xml');
if (!/android:icon="@mipmap\/ic_launcher"/.test(androidManifest)) throw new Error('Android launcher icon is not bound');
console.log('W13.5 canonical 420 Integrated brand asset qualification passed');
