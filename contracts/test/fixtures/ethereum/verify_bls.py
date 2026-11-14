"""Independent BLS12-381/SSZ qualification of an actual mainnet sync update.
This checks the cryptographic statement outside SP1; production uses the pinned guest.
"""
import json
from py_ecc.bls import G2ProofOfPossession as BLS
from verify import ROOT,hb,num,sha,merkle,beacon_root,committee_root,execution_leaves,verify_branch,require

def main():
    bootstrap=json.loads((ROOT/'bootstrap.json').read_text())['data']
    update=json.loads((ROOT/'sync-update.json').read_text())[0]['data']
    spec=json.loads((ROOT/'consensus-spec.json').read_text())['data']
    require(spec['CONFIG_NAME']=='mainnet' and spec['FULU_FORK_VERSION']=='0x06000000','mainnet fork domain')
    attested=update['attested_header'];finalized=update['finalized_header']
    signature_slot=num(update['signature_slot']);attested_slot=num(attested['beacon']['slot']);finalized_slot=num(finalized['beacon']['slot'])
    require(signature_slot>attested_slot>=finalized_slot and signature_slot//8192==num(bootstrap['header']['beacon']['slot'])//8192,'update slot and committee period')
    require((signature_slot-1)//32>=num(spec['FULU_FORK_EPOCH']),'Fulu signature epoch')
    verify_branch(beacon_root(finalized['beacon']),[hb(x) for x in update['finality_branch']],169,hb(attested['beacon']['state_root']))
    verify_branch(committee_root(update['next_sync_committee']),[hb(x) for x in update['next_sync_committee_branch']],87,hb(attested['beacon']['state_root']))
    for header in (attested,finalized):verify_branch(merkle(execution_leaves(header['execution'])),[hb(x) for x in header['execution_branch']],25,hb(header['beacon']['body_root']))
    # DOMAIN_SYNC_COMMITTEE || compute_fork_data_root(version, genesis_validators_root)[:28].
    genesis=hb('4b363db94e286120d76eb905340fdd4e54bfe9f06bf33ff6cf5ad27f511bfe95')
    fork_root=sha(hb(spec['FULU_FORK_VERSION'])+bytes(28)+genesis)
    domain=bytes.fromhex('07000000')+fork_root[:28]
    signing_root=sha(beacon_root(attested['beacon'])+domain)
    bits=hb(update['sync_aggregate']['sync_committee_bits']);require(len(bits)==64,'committee bitvector width')
    keys=[hb(p) for i,p in enumerate(bootstrap['current_sync_committee']['pubkeys']) if bits[i//8]>>(i%8)&1]
    require(len(keys)*3>=512*2,'finality quorum')
    signature=hb(update['sync_aggregate']['sync_committee_signature'])
    require(BLS.FastAggregateVerify(keys,signing_root,signature),'real mainnet BLS aggregate signature')
    require(not BLS.FastAggregateVerify(keys,bytes([signing_root[0]^1])+signing_root[1:],signature),'forged attested root rejected')
    require(not BLS.FastAggregateVerify(keys,signing_root,bytes(96)),'invalid/infinity signature rejected')
    require(not BLS.FastAggregateVerify([],signing_root,signature),'empty participation rejected')
    print(f'PASS: mainnet Fulu sync update, {len(keys)}/512 BLS participants, actual fork/genesis domain, finality/next-committee/execution SSZ proofs; changed signing root, invalid signature and empty participation rejected')
if __name__=='__main__':main()
