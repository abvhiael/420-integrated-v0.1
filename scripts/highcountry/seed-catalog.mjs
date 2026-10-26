import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export const normalizeName = value => value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function validateCatalog(catalog, archive) {
 const fail = message => { throw new Error(message); };
 if(catalog.schema !== 'HC.SEED.CATALOG.V1') fail('schema');
 const regions = new Set(['Emerald Coast','Golden Prairie','Red Mesa']);
 const sources = new Map(catalog.sources.map(s=>[s.id,s]));
 if(sources.size!==4 || catalog.sources.some(s=>!s.filename || !s.libraryFileId || !/^[a-f0-9]{64}$/.test(s.sha256))) fail('sources');
 const names=new Map(), ids=new Set(), panels=new Set(), counts={exclusive:0,common:0,rare:0};
 for(const entry of catalog.cultivars) {
  if(!Object.hasOwn(counts,entry.tier)||!regions.has(entry.region)||ids.has(entry.id)) fail('identity');
  ids.add(entry.id);counts[entry.tier]++;
  for(const label of [entry.name,...entry.aliases]) {
   if(typeof label!=='string'||!label.trim()) fail('name');
   const normalized=normalizeName(label);
   if(names.has(normalized)) fail('duplicate lookup name');
   names.set(normalized,entry.id);
  }
  if(entry.tier==='exclusive') {
   const f=archive.founders.find(f=>f.id===entry.id);
   if(!f||f.name!==entry.name||f.region!==entry.region||entry.canonicalSource?.founderIndex!==f.index) fail('founder changed');
  } else {
   const prefix=entry.tier==='common'?'HC-C-':'HC-R-';
   if(entry.id!==prefix+entry.name.toLowerCase().replaceAll(' ','-')||!entry.sourceArt?.length||entry.genomeStatus!=='not-registered') fail('nonfounder identity');
   for(const ref of entry.sourceArt) {
    if(!sources.has(ref.sourceId)||!Number.isInteger(ref.panel)||ref.panel<1||!ref.printedName||!ref.printedRegion) fail('source reference');
    const key=ref.sourceId+':'+ref.panel;
    if(panels.has(key)) fail('duplicate panel');panels.add(key);
    if(ref.sourceId.startsWith('seal-') && (ref.printedFounderId!==`HC-F${String(ref.panel).padStart(2,'0')}`||ref.founderIdIsInvalidForThisPanel!==true)) fail('concept founder misuse');
   }
  }
 }
 for(const [tier,count] of Object.entries({exclusive:16,common:23,rare:26})) if(counts[tier]!==count||catalog.counts[tier]!==count) fail('counts');
 if(catalog.cultivars.length!==65||catalog.counts.total!==65||panels.size!==68) fail('coverage');
 for(const [sid,max] of [['botanical-2',20],['botanical-3',16],['seal-concept-a',16],['seal-concept-b',16]]) for(let p=1;p<=max;p++) if(!panels.has(`${sid}:${p}`)) fail('missing panel');
 for(const [oldName,newName] of Object.entries({'Emerald Ghost':'Spirit Bear','Harvest Moon':'Blue Moon','Crimson Ghost':'Crow Mother'})) {
  const founder=archive.founders.find(f=>f.name===oldName);
  if(names.get(normalizeName(oldName))!==founder.id) fail('founder alias hijack');
  const rare=catalog.cultivars.find(e=>e.name===newName);
  if(rare?.tier!=='rare'||!rare.sourceArt.some(r=>r.printedName===oldName&&r.contextualRename===true)) fail('contextual rename');
 }
 return {cultivars:65,sourcePanels:68,counts};
}
export function resolveCultivar(catalog, name) {
 const key=normalizeName(name);
 return catalog.cultivars.find(e=>[e.name,...e.aliases].some(n=>normalizeName(n)===key)) ?? null;
}
export function loadCatalog() {
 const root=new URL('../../',import.meta.url);
 return [JSON.parse(readFileSync(new URL('deployments/highcountry/seed-catalog.v1.json',root))),JSON.parse(readFileSync(new URL('deployments/highcountry/original-sixteen-archive.v1.json',root)))];
}
if(process.argv[1]===fileURLToPath(import.meta.url)) console.log(JSON.stringify(validateCatalog(...loadCatalog())));
