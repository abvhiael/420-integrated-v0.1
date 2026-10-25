import { mkdir,copyFile } from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));const require=createRequire(import.meta.url);
await mkdir(resolve(root,'web-dist'),{recursive:true});
const ethersRoot=resolve(dirname(require.resolve('ethers')),'..');
await copyFile(resolve(ethersRoot,'dist/ethers.umd.min.js'),resolve(root,'web-dist/ethers.js'));
for(const name of ['index.html','styles.css','app.js'])await copyFile(resolve(root,'web',name),resolve(root,'web-dist',name));
