import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const source=resolve(import.meta.dirname,'../../../services/bong-goggles-account-social');
const sha=raw=>createHash('sha256').update(raw).digest('hex');
export async function dictionaryFiles(){
 const go=await readFile(resolve(source,'word_salad_dictionary.go'),'utf8');
 const read=async(kind,name)=>{
  const raw=await readFile(resolve(source,'word_salad_lexicon',kind+'.txt'),'utf8');
  const hash=go.match(new RegExp('const wordSalad'+name+'SHA256 = "([a-f0-9]{64})"'))?.[1];
  const count=Number(go.match(new RegExp('const wordSalad'+name+'Count = ([0-9]+)'))?.[1]);
  const words=raw.trimEnd().split('\n');
  if(sha(raw)!==hash||!raw.endsWith('\n')||words.length!==count||words.some((w,i)=>!(/^[A-Z]{2,42}$/).test(w)||i>0&&words[i-1]>=w))throw Error('Invalid dictionary '+kind);
  return words;
 };
 const english=await read('english','English'),cannabis=await read('cannabis','Cannabis');
 const supplement=go.match(/const wordSaladColloquial = "([A-Z ]+)"/)?.[1];
 if(!supplement)throw Error('Missing editorial supplement');
 const general=[...new Set([...english,...supplement.split(' ')])].sort();
 const identity=(g,c)=>{const h=createHash('sha256');h.update(Buffer.from([0]));h.update(g.join('\n')+'\n');h.update(Buffer.from([1]));h.update(c.join('\n')+'\n');return h.digest('hex');};
 const files={};
 for(const [g,label] of [[english,'legacy'],[general,'current']]){
  const id=identity(g,cannabis);
  files[label+'-english.txt']=g.join('\n')+'\n';
  files[label+'-cannabis.txt']=cannabis.join('\n')+'\n';
  files[label+'-identity.txt']=id+'\n';
 }
 return files;
}
export async function publishDictionaries(out){
 const files=await dictionaryFiles(),dir=resolve(out,'word-salad-dictionaries');
 await mkdir(dir,{recursive:true});
 for(const [name,body] of Object.entries(files))await writeFile(resolve(dir,name),body);
}
