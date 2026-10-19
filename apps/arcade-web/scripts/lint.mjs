import fs from 'node:fs';
for(const path of ['src/App.tsx','src/main.tsx','vite.config.ts']){
 const source=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
 for(const prohibited of ['eval(', 'dangerouslySetInnerHTML', 'document.write(', 'eth_sendTransaction', 'window.ethereum'])if(source.includes(prohibited))throw new Error('Unsafe application source: '+path);
}
console.log('420Arcade React source security lint PASS');
