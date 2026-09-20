// BG-19.13 deterministic build qualification: not a browser or network performance benchmark.
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
const root=resolve(import.meta.dirname,'..','dist');
const limits=Object.freeze({singleJs:256*1024,singleCss:256*1024,total:1024*1024});
async function walk(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())files.push(...await walk(path));else if(entry.isFile())files.push({path,size:(await stat(path)).size});}return files;}
const files=await walk(root);const total=files.reduce((sum,file)=>sum+file.size,0);
if(total>limits.total)throw new Error(`static asset budget exceeded: ${total} > ${limits.total}`);
for(const file of files){const name=relative(root,file.path);if(name.endsWith('.js')&&file.size>limits.singleJs)throw new Error(`JavaScript asset budget exceeded: ${name}`);if(name.endsWith('.css')&&file.size>limits.singleCss)throw new Error(`CSS asset budget exceeded: ${name}`);}
const html=await readFile(resolve(root,'index.html'),'utf8');const app=await readFile(resolve(root,'app.js'),'utf8');const css=await readFile(resolve(root,'styles.css'),'utf8');
for(const [name,ok] of Object.entries({'document language':/<html\s+lang="[a-z-]+"/i.test(html),'viewport':/name="viewport"/.test(html),'main landmark':/<main\b/.test(app),'focus treatment':/:focus-visible\b/.test(css),'reduced motion':/prefers-reduced-motion/.test(css),'forced colors':/forced-colors/.test(css),'noindex private default':/name="robots"[^>]*noindex/i.test(html)}))if(!ok)throw new Error(`static accessibility/privacy gate missing: ${name}`);
console.log(`BG-19.13 static build gates passed: ${files.length} files; ${total} bytes; max JS ${limits.singleJs}, CSS ${limits.singleCss}, total ${limits.total}`);
