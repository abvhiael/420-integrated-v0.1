import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const repo=path.resolve(root,'../..');
for(const relative of [
 'src/auth.js','config/auth-policy-template-v1.json','config/signer-rotation-v1.json',
 'schemas/signed-quote-payload-v1.json','schemas/quote-auth-policy-v1.json',
 'test/authentication.test.js','test/fixtures/pre05-ed25519-rfc8032-v1.json'
])if(!fs.existsSync(path.join(root,relative)))throw Error('PRE-05 missing '+relative);
for(const relative of [
 'exchange/web/core/quote-authentication.js',
 'exchange/web/core/executable-quote-intake.js',
 'exchange/web/core/canonical-execution-inputs.js',
 'exchange/web/core/reviewed-execution-bridge.js',
 'exchange/web/core/bound-swap-review.js'
])if(!fs.existsSync(path.join(repo,relative)))throw Error('PRE-05 missing '+relative);
const core=[
 'exchange/web/core/quote-authentication.js',
 'exchange/web/core/executable-quote-intake.js',
 'exchange/web/core/canonical-execution-inputs.js',
 'exchange/web/core/reviewed-execution-bridge.js',
 'exchange/web/core/bound-swap-review.js'
].map(relative=>fs.readFileSync(path.join(repo,relative),'utf8')).join('\n');
if(/sourceAuthenticated\s*=|sourceAuthenticated\s*:|QUALIFIED_EXECUTION/.test(core))throw Error('PRE-05 legacy caller trust flag or provenance shortcut remains in executable core');
for(const marker of [
 'TRUSTED_EXECUTION_QUOTE','AUTHENTICATED_EXECUTION','verifyQuoteAuthentication','createQuoteReplayGuard',
 'isVerifiedQuoteEvidence','Ed25519','transactionFingerprint','REPLAY_DOMAIN_MISMATCH','ENDPOINT_MISMATCH'
])if(!core.includes(marker))throw Error('PRE-05 executable trust boundary missing '+marker);
const auth=fs.readFileSync(path.join(root,'src/auth.js'),'utf8');
for(const marker of ['canonicalSignedQuotePayload','createEd25519Signer','publicKeyFingerprint','signedPayloadHash'])if(!auth.includes(marker))throw Error('PRE-05 signer implementation missing '+marker);
const template=JSON.parse(fs.readFileSync(path.join(root,'config/auth-policy-template-v1.json'),'utf8'));
if(template.status!=='UNRESOLVED'||template.producers.length!==0||template.endpointUrl!==null||template.deployment!==null)throw Error('checked-in PRE-05 trust policy must remain unresolved without fabricated production key/deployment');
console.log('420Exchange PRE-05 authenticity/provenance/replay static checks passed');
