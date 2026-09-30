import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const relative of [
 'src/quote-engine.js','src/http.js','src/adapters.js','src/redaction.js','src/rate-limit.js','src/validation.js',
 'schemas/executable-swap-quote-request-v1.json','schemas/executable-swap-quote-response-v1.json','schemas/error-v1.json',
 'fixtures/pre04-vector-v1.json','config/signer-rotation-v1.json','test/quote-engine.test.js','test/http.test.js','test/browser-intake-compat.test.js'
])if(!fs.existsSync(path.join(root,relative)))throw Error('PRE-04 missing '+relative);
const engine=fs.readFileSync(path.join(root,'src/quote-engine.js'),'utf8');
for(const marker of ['deploymentId','manifestHash','replayDomain','quoteEconomics','builder','DEFERRED_TO_PRE05','SIGNER_ROTATION_MODEL'])if(!engine.includes(marker))throw Error('PRE-04 quote engine missing '+marker);
const http=fs.readFileSync(path.join(root,'src/http.js'),'utf8');
for(const marker of ['/executable-swap-quote','REQUEST_TOO_LARGE','RATE_LIMITED','RESPONSE_TOO_LARGE','createRedactedLogger'])if(!http.includes(marker))throw Error('PRE-04 HTTP service missing '+marker);
for(const relative of ['fixtures/pre04-vector-v1.json','config/signer-rotation-v1.json']){
 const text=fs.readFileSync(path.join(root,relative),'utf8');
 if(/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|mnemonic\s*[:=]\s*["'][^"']+|private[_-]?key\s*[:=]\s*["'][0-9a-f]/i.test(text))throw Error('PRE-04 artifact contains forbidden key material: '+relative);
}
const vector=JSON.parse(fs.readFileSync(path.join(root,'fixtures/pre04-vector-v1.json'),'utf8'));
if(vector.expected.quoteId!=='0xc1cd1a0c511b01e93916317fef14bca9e1bef5a4975614cd3855edbecfb78fb6')throw Error('PRE-04 deterministic vector changed unexpectedly');
console.log('420Exchange PRE-04 quote backend static checks passed');
