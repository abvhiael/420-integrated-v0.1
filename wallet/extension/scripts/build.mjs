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
  'popup.css',
  'popup.js',
  'wallet.html',
  'wallet.css',
  'wallet.js',
  'authority.html',
  'authority.js',
];

export async function buildExtension420() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  for (const file of sourceFiles) await cp(join(extensionRoot, file), join(dist, file));
  await cp(join(walletRoot, 'web', 'core'), join(dist, 'core'), { recursive: true });
  await cp(join(extensionRoot, 'core'), join(dist, 'core'), { recursive: true });
  await cp(join(extensionRoot, 'vendor'), join(dist, 'vendor'), { recursive: true });
  try {
    const {build}=await import('esbuild');
    await build({
      entryPoints:[join(extensionRoot,'trezor-connect-entry.mjs')],
      bundle:true,format:'esm',platform:'browser',target:'chrome120',
      outfile:join(dist,'vendor','trezor-connect-10.bundle.js'),
      legalComments:'inline',
      logLevel:'silent',
    });
  }catch(error){
    if(process.env.WALLET_HARDWARE_RELEASE==='1')
      throw new Error('Trezor Connect 10 must be locally bundled for hardware release: '+error.message);
    // Other wallet tests have no npm-installed hardware SDK: those builds
    // do not claim Trezor availability. Runtime import fails closed.
  }

  return { dist, files: await readdir(dist) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildExtension420();
  console.log(`420 Wallet extension build complete: ${result.dist}`);
}
