#!/usr/bin/env python3
"""R07.2 reproducible DEVELOPMENT rehearsal, not approved Genesis or a live transaction."""
import json, hashlib, sys
from pathlib import Path
try:
    from Crypto.Hash import keccak
except ImportError as e:
    raise SystemExit("pycryptodome required for Ethereum Keccak; do NOT substitute SHA3-256") from e

def k(data):
    h=keccak.new(digest_bits=256);h.update(data);return h.digest()
def h(v):return '0x'+v.hex()
def word(n):return n.to_bytes(32,'big')
def raw32(s):
    if not isinstance(s,str) or not s.startswith('0x') or len(s)!=66:raise ValueError('bytes32')
    return bytes.fromhex(s[2:])
def addr(s):
    if not isinstance(s,str) or not s.startswith('0x') or len(s)!=42:raise ValueError('address')
    b=bytes.fromhex(s[2:]);assert int.from_bytes(b,'big')!=0;return b
def land_leaf(p):
    # Solidity abi.encode(uint64,uint16,address,uint32,bytes32,bytes32)
    return k(word(p['parcelId'])+word(p['regionId'])+addr(p['owner']).rjust(32,b'\0')+word(p['growCapacity'])+raw32(p['parcelType'])+raw32(p['metadataHash']))
def pair(a,b):return k(min(a,b)+max(a,b))
def tree(leaves):
    if not leaves:raise ValueError('no founding parcels')
    levels=[leaves]
    while len(levels[-1])>1:
        row=levels[-1]
        levels.append([pair(row[i],row[i+1]) if i+1<len(row) else row[i] for i in range(0,len(row),2)])
    proofs=[]
    for index in range(len(leaves)):
        idx=index;path=[]
        for row in levels[:-1]:
            if idx^1<len(row):path.append(h(row[idx^1]))
            idx//=2
        proofs.append(path)
    return levels[-1][0],proofs
def verify_proof(leaf,proof,root):
    for sibling in proof:leaf=pair(leaf,raw32(sibling))
    return leaf==root
def stable(obj):return json.dumps(obj,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()
def make(seed):
    if seed.get('releaseStatus')!='DEVELOPMENT_FIXTURE_NOT_APPROVED':raise ValueError('unapproved release marker')
    regions=seed['regions'];founders=seed['founders'];parcels=seed['parcels']
    if [x['id'] for x in regions]!=[1,2,3]:raise ValueError('three regions required')
    if [x['index'] for x in founders]!=list(range(1,17)):raise ValueError('sixteen founders required')
    if not parcels:raise ValueError('founding land absent')
    for r in regions:
        for key in ('metadataHash','climateProfileId','rulesetId'):raw32(r[key])
    for f in founders:
        if len(f['loci'])!=28:raise ValueError('28 loci required')
        raw32(f['genomeId']);raw32(f['metadataHash'])
        for locus in f['loci']:raw32(locus)
    ids=set()
    for p in parcels:
        if p['parcelId'] in ids:raise ValueError('duplicate founding parcel')
        ids.add(p['parcelId'])
        if p['regionId'] not in [1,2,3] or p['growCapacity']<1:raise ValueError('invalid parcel')
    leaves=[land_leaf(p) for p in parcels]
    land_root,proofs=tree(leaves)
    for i,proof in enumerate(proofs):
        if not verify_proof(leaves[i],proof,land_root):raise AssertionError('invalid Merkle path')
    roots={
      'manifestRoot':h(k(stable({'schema':'hc-r07-2-rehearsal-v1','regions':regions,'founders':founders,'parcels':parcels}))),
      'parameterRoot':h(k(stable({'regions':regions,'policy':'DEVELOPMENT_ONLY'}))),
      'rulesetRoot':h(k(stable([r['rulesetId'] for r in regions]))),
      'landRoot':h(land_root),
      'randomnessRoot':h(k(b'HC.R07.2.DEVELOPMENT.RANDOMNESS.NOT_A_PROVIDER_V1')),
      'qualificationRoot':h(k(stable({'rehearsal':True,'scope':'NO_LIVE_GENESIS'})))
    }
    return {'schema':'hc-r07-2-rehearsal-output-v1','releaseStatus':seed['releaseStatus'],'roots':roots,'regions':regions,'founders':founders,'parcels':[{**p,'leaf':h(leaves[i]),'proof':proofs[i]} for i,p in enumerate(parcels)],'prefinalization':{'sixRootsNonzero':all(int(x,16)>0 for x in roots.values()),'threeRegions':len(regions)==3,'sixteenFounders':len(founders)==16,'allFounders28Loci':all(len(f['loci'])==28 for f in founders),'allLandProofsVerify':True,'onChainRehearsal':False,'finalizationAuthorized':False}}
def main():
    inp=Path(sys.argv[1]) if len(sys.argv)>1 else Path('deployments/highcountry/r07-2.dev-seed.json')
    o=make(json.loads(inp.read_text()))
    output=json.dumps(o,indent=2,sort_keys=True)+'\n'
    if '--check' in sys.argv:
        existing=Path('deployments/highcountry/r07-2.dev-output.json').read_text()
        if existing!=output:raise SystemExit('derived output mismatch')
    else:sys.stdout.write(output)
if __name__=='__main__':main()
