#!/usr/bin/env python3
"""Compare every affected retained Swap/Pay runtime with fresh constructor execution."""
import argparse, json
from pathlib import Path
from eth_abi import encode,decode
from eth_hash.auto import keccak
import reconcile_v2 as v
r=v.module('rehearsal12',v.HERE/'rehearse.py')
p=v.p

def run(anvil,output):
    frozen,drift=p.commitment();assert not drift,'frozen authority drift'
    gov=frozen['commitmentPayload']['governanceTimelock'];cfg=frozen['genesisConfigHash'];args=[gov,p.REGISTRY,bytes.fromhex(cfg[2:])]
    output.mkdir(parents=True,exist_ok=True);node=r.Node(anvil,output/'anvil.log');records=[]
    try:
        node.ready();sender=node.rpc('eth_accounts',[])[0]
        def deploy(name,types,values):
            raw=json.loads((p.ROOT/'contracts/out'/f'{name}.sol'/f'{name}.json').read_text())
            receipt=node.transact(sender,raw['bytecode']['object']+encode(types,values).hex())
            address=receipt['contractAddress'];code=node.rpc('eth_getCode',[address,'latest'])
            assert decode(['address'],node.call(address,'registry()'))[0]==p.REGISTRY
            assert decode(['address'],node.call(address,'governanceTimelock()'))[0]==gov
            assert node.call(address,'genesisConfigHash()')==bytes.fromhex(cfg[2:])
            return raw,receipt,address,code
        _,_,executor,_=deploy('CanonicalSwapExecutor420',['address','address','bytes32'],args)
        pay={x['contract']:x for x in json.loads(v.pay.PACKAGE.read_text())['residents']}
        for name in list(v.s.FROZEN)+list(v.pay.RESIDENTS):
            types=['address','address','bytes32'];values=list(args)
            if name=='CanonicalSettlementAdapter420':types.append('address');values.append(executor)
            raw,receipt,address,code=deploy(name,types,values)
            if name in v.s.FROZEN:
                state=json.loads((v.s.PREDEPLOY_DIR/f'{name}-predeploy-state.json').read_text())
                assert code==state['runtimeBytecode'],'Swap constructor runtime mismatch'
                expected=state['runtimeCodeHash'];fixed=state['address']
                for item in raw['storageLayout']['storage']:
                    assert int(node.rpc('eth_getStorageAt',[address,hex(int(item['slot'])),'latest']),16)==0,'Swap constructor storage mismatch'
                node.rpc('anvil_setCode',[fixed,code]);assert node.call(fixed,'genesisConfigHash()')==bytes.fromhex(cfg[2:])
            else:expected=pay[name]['runtime_code_hash'];fixed=None
            actual='0x'+keccak(bytes.fromhex(code[2:])).hex();assert expected==actual,(name,'runtime identity')
            records.append({'name':name,'runtime_code_hash':actual,'runtime_bytes':(len(code)-2)//2,'frozen_address':fixed,'constructor_receipt':receipt['transactionHash'],'compiler_artifact_sha256':p.sha(p.dump(raw).encode())})
        source_paths=[p.ROOT/'contracts/src'/src for src,_ in list(v.s.DEPLOYMENT_COMPONENTS.values())+list(v.pay.RESIDENTS.values())]
        sources=p.closure(source_paths)
        result={'pass':True,'genesis_config_hash':cfg,'chain_id':31337,'environment':'fresh owned Anvil; canonical V2 constructors, no live deployment','affected_retained_runtimes':records,'count':len(records),'source_sha256':{k:p.sha(x['content'].encode()) for k,x in sources.items()},'production_approvals':[]}
        p.write(output/'RESULTS.json',result)
        print(json.dumps({'pass':True,'constructor_runtime_comparisons':len(records),'configuration':cfg}))
    finally:node.close()
if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('--anvil',required=True);a.add_argument('--output',type=Path,required=True);args=a.parse_args();run(args.anvil,args.output)
