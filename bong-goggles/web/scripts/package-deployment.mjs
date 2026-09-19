import {readFile,readdir,writeFile,cp,mkdir,rm} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {validateDeploymentCandidate} from '../core/deployment-readiness.js';

// Run `npm run build` first. This script does not deploy, approve a launch or emit secrets.
const root=resolve(import.meta.dirname,'..');
const source=resolve(root,'dist');
const destination=resolve(root,'dist-deployment');
const configPath=process.env.BG_WEB_RUNTIME_CONFIG;
const target=process.env.BG_WEB_DEPLOY_TARGET;
if(!configPath||!target)throw new Error('BG_WEB_RUNTIME_CONFIG and BG_WEB_DEPLOY_TARGET are required');
if(resolve(configPath)===resolve(root,'runtime-config.example.json'))throw new Error('example runtime configuration cannot be deployed');
const supplied=JSON.parse(await readFile(resolve(configPath),'utf8'));
const validated=validateDeploymentCandidate(supplied,{expectedEnvironment:target});
for(const file of ['index.html','app.js','styles.css','settings.css','_headers'])await readFile(resolve(source,file));
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});
await cp(source,destination,{recursive:true});
await writeFile(resolve(destination,'runtime-config.json'),JSON.stringify(supplied,null,2)+'\n',{mode:0o644});
const manifest=[];
async function collect(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())await collect(path);else if(entry.isFile()){const bytes=await readFile(path);manifest.push({path:relative(destination,path).replaceAll('\\','/'),size:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex')});}}}
await collect(destination);
manifest.sort((a,b)=>a.path.localeCompare(b.path));
await writeFile(resolve(root,'deployment-manifest.json'),JSON.stringify({schema:'bg19-deployment-candidate-v1',target:validated.environment,appOrigin:validated.appOrigin,maintenance:validated.maintenance,launchApproved:false,files:manifest},null,2)+'\n');
console.log(`Deployment candidate packaged for ${validated.environment}; NOT deployed or launch-approved`);
