import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const required=[
  'index.html','app.js','styles.css','package.json','runtime-config.example.json',
  'core/runtime-config.js','core/services.js','core/bootstrap.js','core/telemetry.js'
];

for(const file of required) await readFile(resolve(root,file),'utf8');

const html=await readFile(resolve(root,'index.html'),'utf8');
for(const token of ['Content-Security-Policy','frame-ancestors \'none\'','type="module"']){
  if(!html.includes(token)) throw new Error(`missing required HTML hardening: ${token}`);
}

const config=JSON.parse(await readFile(resolve(root,'runtime-config.example.json'),'utf8'));
const requiredConfig=['environment','appOrigin','chainId','rpcUrl','indexerUrl','mediaUrl','messengerUrl','notificationsUrl','walletUrl','explorerUrl'];
for(const key of requiredConfig) if(config[key]===undefined) throw new Error(`runtime config missing ${key}`);

const secretPattern=/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|mnemonic\s*[:=]|seed[_ -]?phrase\s*[:=]|private[_-]?key\s*[:=]/i;
for(const dir of ['core','.']){
  const names=await readdir(resolve(root,dir),{withFileTypes:true});
  for(const entry of names){
    if(!entry.isFile()||!entry.name.endsWith('.js')) continue;
    const body=await readFile(resolve(root,dir,entry.name),'utf8');
    if(secretPattern.test(body)) throw new Error(`potential frontend secret material in ${dir}/${entry.name}`);
  }
}
console.log('Bong Goggles web static checks passed');
