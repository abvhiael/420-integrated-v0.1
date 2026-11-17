#!/usr/bin/env python3
"""Prepare canonical constructor inputs and materialize the frozen disabled gateway.
Executes constructor code on a fresh owned local EVM, never sends a live transaction.
"""
import argparse, importlib.util, json
from pathlib import Path
from eth_abi import encode,decode
from eth_hash.auto import keccak
spec=importlib.util.spec_from_file_location('rehearsal12',Path(__file__).with_name('rehearse.py'));r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r);p=r.pkg

def commitment():
    return p.commitment()

def prepare(package,anvil,output):
    p.namespace();cfg,drift=commitment();assert not drift, 'frozen authority drift';output.mkdir(parents=True,exist_ok=True);gov=cfg['commitmentPayload']['governanceTimelock'];config=cfg['genesisConfigHash']
    manifest=json.loads((package/'manifest.json').read_text());records={x['name']:x for x in manifest['contracts']}
    # All actual bridge and external constructor dependencies are explicit in their compiler ABI.
    templates=[]
    for name,rec in records.items():
        if rec['classification'] in ['interface_or_abstract','legacy_disabled','dependency_registry']:continue
        values=[]
        for item in rec['constructor']:
            n=item['name'].lower();value=gov if n in ['gov','governance','timelock_','governance_','governancetimelock_'] else p.REGISTRY if n in ['registry','registry_'] else config if n in ['genesisconfighash_','config'] else r.ZERO if name=='VerifiedGateway420' and n=='verifier_' else None
            values.append({'name':item['name'],'type':p.abi_type(item),'value':value,'resolution':'PINNED_GENESIS' if value is not None else 'EXPLICIT_DEPLOYMENT_INPUT_REQUIRED'})
        templates.append({'contract':name,'source':rec['source'],'classification':rec['classification'],'constructor':values,'artifact_sha256':rec['artifact_sha256']})
    inventory={'current_authority_drift':drift,'deployment_ready':not drift,'schema':'420-bridge-pretestnet-constructor-inputs-v1','governance_timelock':gov,'registry':p.REGISTRY,'genesis_config_hash':config,'frozen_gateway':p.GATEWAY,'core_publication_order':p.CORE,'custody_constructor_dependency':'publish BridgeVerifierRegistry420 before BridgeValueCustody420; independently qualified IBridgeWithdrawalOutcome420 required','legacy_excluded':sorted(p.LEGACY),'constructors':templates,'external_inputs':'Actual source/issuer/validator roots, deployed verifier/provider/token/custody dependencies and deployer/nonce/chain ID from existing testnet handoff; null is never encoded or deployed automatically','production_approvals':[],'routes_active':False}
    p.write(output/'constructor-parameters.json',inventory)
    node=r.Node(anvil,output/'materialization-anvil.log')
    try:
        node.ready();sender=node.rpc('eth_accounts',[])[0];artifact=json.loads((package/'artifacts/VerifiedGateway420.json').read_text());assert p.sha(p.dump(artifact).encode())==records['VerifiedGateway420']['artifact_sha256']
        args=[gov,p.REGISTRY,bytes.fromhex(config[2:]),r.ZERO]
        receipt=node.transact(sender,'0x'+artifact['evm']['bytecode']['object']+encode(['address','address','bytes32','address'],args).hex());temporary=receipt['contractAddress'];code=node.rpc('eth_getCode',[temporary,'latest'])
        # Exact comparison outside compiler-declared immutable references, followed by getter checks.
        expected=bytearray.fromhex(artifact['evm']['deployedBytecode']['object']);observed=bytearray.fromhex(code[2:]);immutable_values={}
        for identifier,locations in artifact['evm']['deployedBytecode']['immutableReferences'].items():
            words=[]
            for item in locations:
                i=item['start'];n=item['length'];words.append(code[2+i*2:2+(i+n)*2]);expected[i:i+n]=b'\0'*n;observed[i:i+n]=b'\0'*n
            assert len(set(words))==1,'inconsistent immutable occurrences';immutable_values[identifier]='0x'+words[0]
        assert expected==observed,'materialized runtime mismatch'
        storage={}
        for item in artifact['storageLayout']['storage']:
            key='0x'+int(item['slot']).to_bytes(32,'big').hex();value=node.rpc('eth_getStorageAt',[temporary,key,'latest']);assert int(value,16)==0;storage[key]=value
        node.rpc('anvil_setCode',[p.GATEWAY,code])
        assert decode(['address'],node.call(p.GATEWAY,'registry()'))[0]==p.REGISTRY
        assert decode(['address'],node.call(p.GATEWAY,'governanceTimelock()'))[0]==gov
        assert node.call(p.GATEWAY,'genesisConfigHash()')==bytes.fromhex(config[2:])
        assert decode(['address'],node.call(p.GATEWAY,'verifier()'))[0]==r.ZERO
        assert node.call(p.GATEWAY,'qualificationId()')==b'\0'*32
        materialized={'schema':'420-bridge-materialized-artifact-v1','source':records['VerifiedGateway420']['source'],'compiler':'0.8.24+commit.e11b9ed9','compiler_input_sha256':manifest['compiler_input_sha256'],'template_artifact_sha256':records['VerifiedGateway420']['artifact_sha256'],'abi':artifact['abi'],'bytecode':artifact['evm']['bytecode'],'deployedBytecode':{'object':code,'immutableReferences':artifact['evm']['deployedBytecode']['immutableReferences']},'storageLayout':artifact['storageLayout']}
        state={'schema':'420-bridge-predeploy-state-v1','status':'LOCAL_FROZEN_SNAPSHOT_MATERIALIZED_CURRENT_AUTHORITY_DRIFT' if drift else 'BRIDGE_AUDIT_12_LOCAL_CONSTRUCTOR_MATERIALIZED','current_authority_drift':drift,'deployment_ready':not drift,'name':'VerifiedGateway420','address':p.GATEWAY,'constructor':{'governanceTimelock':gov,'registry':p.REGISTRY,'genesisConfigHash':config,'verifier':r.ZERO},'immutable_values':immutable_values,'runtimeCodeHash':'0x'+keccak(bytes.fromhex(code[2:])).hex(),'runtimeBytes':(len(code)-2)//2,'storage':{},'storageRoot':'0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421','storage_basis':'All declared constructor slots read zero on fresh EVM; mapping roots and entries absent; no constructor external calls. Immutable values are in runtime, never storage.','checked_zero_slots':storage,'production_approvals':[],'live_deployed':False}
        p.write(output/'VerifiedGateway420.json',materialized);p.write(output/'VerifiedGateway420-predeploy-state.json',state)
        p.write(output/'gateway-genesis-allocation.json',{'deployment_ready':not drift,'current_authority_drift':drift,'alloc':{p.GATEWAY:{'code':code,'storage':{},'balance':'0x0'}}})
        print(json.dumps({'pass':True,'address':p.GATEWAY,'runtimeCodeHash':state['runtimeCodeHash'],'runtimeBytes':state['runtimeBytes'],'storageRoot':state['storageRoot'],'templates':len(templates),'deployment_ready':not drift,'authority_drift_count':len(drift)}))
    finally:node.close()
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,required=True);parser.add_argument('--anvil',required=True);parser.add_argument('--output',type=Path,required=True);a=parser.parse_args();prepare(a.package,a.anvil,a.output)
