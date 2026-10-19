import fs from 'node:fs';
for(const path of ['src/main.mjs','scripts/build.mjs','scripts/lint.mjs','test/bootstrap.test.mjs']){const s=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');if(s.includes('eval(')||s.includes('innerHTML')||s.includes('document.write('))throw new Error('Unsafe executable DOM API: '+path);}
console.log('Arcade bootstrap unsafe-DOM lint PASS');
