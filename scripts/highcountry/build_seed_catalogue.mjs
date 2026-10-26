import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {SeedCatalogue} from '../../services/highcountry-economy/src/seed-catalogue.js';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
export async function publicSeedCatalogue(){const load=async n=>JSON.parse(await readFile(new URL('deployments/highcountry/'+n,root),'utf8'));return new SeedCatalogue({catalog:await load('seed-catalog.v1.json'),research:await load('common-cultivar-research.v1.json'),rarePairs:await load('rare-parent-pairs.v1.json'),founders:await load('original-sixteen-archive.v1.json')}).browse();}
export async function writePublicSeedCatalogue(target=new URL('apps/highcountry-web/public/assets/highcountry/seed-catalogue.v1.json',root)){await mkdir(new URL('.',target),{recursive:true});await writeFile(target,JSON.stringify(await publicSeedCatalogue(),null,2)+'\n');}
if(process.argv[1]===fileURLToPath(import.meta.url))await writePublicSeedCatalogue();
