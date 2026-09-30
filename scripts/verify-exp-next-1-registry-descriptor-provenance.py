#!/usr/bin/env python3
import hashlib,json,pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
errors=[]
manifest=json.loads((ROOT/'420-indexer/descriptors/protocol-registry-v4.json').read_text())
expected='0bb8d571d38eeb66d7b277253cdae65b6b14c7538f95dc809db6818c8a79db81'
payload={k:manifest[k] for k in ('canonicalAddress','contractName','events','protocolVersion','source')}
digest=hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',',':')).encode()).hexdigest()
if digest!=expected or manifest.get('descriptorSha256')!=expected: errors.append('descriptor hash drift')
if manifest.get('canonicalAddress')!='0x0000000000000000000000000000000000000434': errors.append('Registry address drift')
source=ROOT/manifest['source']['path']
blob=subprocess.check_output(['git','hash-object',str(source)],cwd=ROOT,text=True).strip()
if blob!=manifest['source']['gitBlobSha']: errors.append('ProtocolRegistry source blob drift')
required={'ServiceVersionPublished','ServiceRegistrationProfilePublished','ServiceDeprecated'}
if {e['name'] for e in manifest['events']}!=required: errors.append('required Registry event set drift')
ts=(ROOT/'420-indexer/src/abi-manifest.ts').read_text()
decoder=(ROOT/'420-indexer/src/protocol-decoder.ts').read_text()
tests=(ROOT/'420-indexer/test/protocol-registry-release-descriptor.test.ts').read_text()
for token in [expected,'descriptorsFromProtocolRegistryRelease420','repository_descriptor_only_not_live_registry_authority']:
    if token not in ts and token not in json.dumps(manifest): errors.append('missing release descriptor guard '+token)
if 'protocol descriptor contract mismatch' not in decoder: errors.append('contract identity mismatch is not fail-closed')
for token in ['known ServiceVersionPublished vector','registration profile vector','wrong contract address','hash drift']:
    if token not in tests: errors.append('missing required test '+token)
road=json.loads((ROOT/'docs/audit/EXP-2R.5-authoritative-next-phase-roadmap.json').read_text())
step=next((s for s in road['sequence'] if s['id']=='EXP-NEXT.1'),None)
if not step or step['title']!='Registry ABI/descriptor release provenance': errors.append('canonical roadmap mismatch')
audit=json.loads((ROOT/'docs/audit/EXP-NEXT.1-registry-descriptor-provenance.json').read_text())
if audit.get('scope',{}).get('live_registry_publication_qualified') is not False: errors.append('live authority overclaim')
out=ROOT/'exp-next-1-evidence'; out.mkdir(exist_ok=True)
(out/'summary.json').write_text(json.dumps({'step':'EXP-NEXT.1','descriptorSha256':digest,'sourceBlobSha':blob,'errors':errors},indent=2)+'\n')
if errors:
    print('\n'.join('ERROR: '+e for e in errors)); sys.exit(1)
print('EXP-NEXT.1 verifier passed')
