import crypto from 'node:crypto';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const out=path.resolve(process.argv[2]??path.join(root,'artifacts/exchange/pretestnet-package-manifest.json'));
const sourceSha=process.env.EXCHANGE_BUILD_SHA||process.env.GITHUB_SHA||'local';
const roots=['exchange/web','exchange/quote-service','exchange/order-service','exchange/read-service','exchange/shared'];
const excluded=new Set(['dist','node_modules','acceptance-evidence','state']);
const files=[];
function walk(dir){
 for(const ent of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  if(excluded.has(ent.name))continue;
  const abs=path.join(dir,ent.name);
  if(ent.isDirectory())walk(abs);
  else if(ent.isFile()){
    const rel=path.relative(root,abs).replaceAll('\\','/');
    const bytes=fs.readFileSync(abs);
    files.push({path:rel,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
 }
}
for(const rel of roots)walk(path.join(root,rel));
for(const rel of ['exchange/pretestnet-readiness.json']){const abs=path.join(root,rel),bytes=fs.readFileSync(abs);files.push({path:rel,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
files.sort((a,b)=>a.path.localeCompare(b.path));
const manifest={schema:'420-exchange-pretestnet-package-v1',sourceSha,files,liveGates:'exchange/pretestnet-readiness.json'};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(manifest,null,2)+'\n');
console.log(out);
