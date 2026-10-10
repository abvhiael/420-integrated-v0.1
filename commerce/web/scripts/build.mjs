import {build} from 'esbuild';
import {readFileSync,mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {validateConfig} from '../core/wallet.js';
let config=null;
if(process.env.COMMERCE_WEB_MANIFEST){const bytes=readFileSync(process.env.COMMERCE_WEB_MANIFEST);if(!/^[a-f0-9]{64}$/.test(process.env.COMMERCE_WEB_MANIFEST_SHA256??'')||createHash('sha256').update(bytes).digest('hex')!==process.env.COMMERCE_WEB_MANIFEST_SHA256)throw new Error('Approved manifest SHA256 required');config=validateConfig(JSON.parse(bytes));}
const output=process.env.COMMERCE_WEB_TEST_OUTPUT?resolve(process.env.COMMERCE_WEB_TEST_OUTPUT):new URL('../dist',import.meta.url).pathname;
if(process.env.COMMERCE_WEB_TEST_OUTPUT&&(!/com4-browser-[^/]+\/site$/.test(output)||basename(output)!=='site'))throw new Error('Invalid isolated browser-test output');
rmSync(output,{recursive:true,force:true});mkdirSync(output,{recursive:true});
await build({entryPoints:[new URL('../app.js',import.meta.url).pathname,new URL('../public.js',import.meta.url).pathname,new URL('../operations.js',import.meta.url).pathname],bundle:true,format:'esm',target:'es2022',outdir:output,define:{COMMERCE_CONFIG:JSON.stringify(config)}});
for(const file of ['index.html','style.css','public.html','public.css','operations.html','high-street-logo.svg'])copyFileSync(new URL('../'+file,import.meta.url),resolve(output,file));
writeFileSync(resolve(output,'_headers'),`/*\n  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Cache-Control: no-store\n`);
console.log('Commerce static builder built; approved deployment configuration '+(config?'pinned':'absent — signing disabled'));
