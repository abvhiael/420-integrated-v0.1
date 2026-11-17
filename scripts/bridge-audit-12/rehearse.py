#!/usr/bin/env python3
"""Run the unsigned Bridge plan only on a fresh, owned local Anvil instance.
Materialization RPCs are confined to this process; never accepts a remote URL.
"""
import argparse, gzip, importlib.util, json, socket, subprocess, time, urllib.request
from pathlib import Path
from eth_abi import encode, decode
from eth_hash.auto import keccak
spec=importlib.util.spec_from_file_location('package12',Path(__file__).with_name('package.py'));pkg=importlib.util.module_from_spec(spec);spec.loader.exec_module(pkg)
ZERO='0x'+'00'*20
class Node:
    def __init__(self, binary, log):
        with socket.socket() as s:s.bind(('127.0.0.1',0));self.port=s.getsockname()[1]
        self.log=log.open('w');self.proc=subprocess.Popen([binary,'--host','127.0.0.1','--port',str(self.port),'--chain-id','31337','--hardfork','cancun','--silent'],stdout=self.log,stderr=subprocess.STDOUT)
        self.url=f'http://127.0.0.1:{self.port}'
    def rpc(self, method, params):
        req=urllib.request.Request(self.url,data=json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params}).encode(),headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=30) as r:result=json.load(r)
        if 'error' in result:raise ValueError(result['error'])
        return result['result']
    def ready(self):
        for _ in range(100):
            if self.proc.poll() is not None:raise RuntimeError('Anvil exited')
            try:
                assert int(self.rpc('eth_chainId',[]),16)==31337;return
            except (OSError,ValueError):time.sleep(.05)
        raise RuntimeError('Anvil startup timeout')
    def close(self):self.proc.terminate();self.proc.wait(timeout=15);self.log.close()
    def transact(self, sender, data, to=None, nonce=None):
        tx={'from':sender,'data':data,'gas':'0x1c9c380','value':'0x0'}
        if to:tx['to']=to
        if nonce is not None:tx['nonce']=hex(nonce)
        h=self.rpc('eth_sendTransaction',[tx]);receipt=None
        for _ in range(200):
            receipt=self.rpc('eth_getTransactionReceipt',[h])
            if receipt is not None:break
            time.sleep(.01)
        assert receipt and int(receipt['status'],16)==1,receipt
        return receipt
    def call(self, target, signature, types=(), args=(), sender=None):
        tx={'to':target,'data':'0x'+(keccak(signature.encode())[:4]+encode(types,args)).hex()}
        if sender:tx['from']=sender
        return bytes.fromhex(self.rpc('eth_call',[tx,'latest'])[2:])

def run(package, anvil, solc, output):
    output.mkdir(parents=True,exist_ok=True);node=Node(anvil,output/'anvil.log')
    checks=[];deployments=[]
    def passed(name):checks.append(name)
    try:
        node.ready();accounts=node.rpc('eth_accounts',[]);gov=accounts[0];stranger=accounts[1]
        manifest=json.loads((package/'manifest.json').read_text());records={r['name']:r for r in manifest['contracts']}
        def artifact(name):
            a=json.loads((package/'artifacts'/f'{name}.json').read_text());assert pkg.sha(pkg.dump(a).encode())==records[name]['artifact_sha256'];return a
        def deploy(name, types, args):
            a=artifact(name);receipt=node.transact(gov,'0x'+a['evm']['bytecode']['object']+encode(types,args).hex());address=receipt['contractAddress'];actual=node.rpc('eth_getCode',[address,'latest']);assert (len(actual)-2)//2==records[name]['runtime_bytes'];return address,receipt
        registry,receipt=deploy('ProtocolRegistry',['address'],[gov])
        node.rpc('anvil_setCode',[pkg.REGISTRY,node.rpc('eth_getCode',[registry,'latest'])]);passed('canonical Registry materialized at frozen 0x434')
        config='0x'+keccak(b'BRIDGE-AUDIT-12/CONTROLLED-LOCAL-REHEARSAL').hex()
        core=[n for n in pkg.CORE if n!='BridgeValueCustody420']
        args={n:[gov,pkg.REGISTRY,config]+([ZERO] if n=='VerifiedGateway420' else []) for n in core}
        params={'environment':'local_rehearsal','chain_id':31337,'governance':gov,'deployer':gov,'registry':pkg.REGISTRY,'genesis_config_hash':config,'start_nonce':int(node.rpc('eth_getTransactionCount',[gov,'latest']),16),'contracts':[{'name':n,'args':args[n]} for n in core]}
        plan=pkg.make_plan(package,params);pkg.write(output/'unsigned-plan.json',plan)
        deployed={}
        for step in plan['steps']:
            tx=step.get('transaction');receipt=node.transact(gov,tx['data'],nonce=tx['nonce']) if tx else node.transact(stranger,step['genesis_initcode']);actual=receipt['contractAddress'];a=artifact(step['name'])
            runtime=node.rpc('eth_getCode',[actual,'latest']);assert (len(runtime)-2)//2==records[step['name']]['runtime_bytes']
            # Compare every nonimmutable byte; constructor-supplied immutable words are tested by getters below.
            template=bytearray.fromhex(a['evm']['deployedBytecode']['object']);observed=bytearray.fromhex(runtime[2:])
            for locations in a['evm']['deployedBytecode'].get('immutableReferences',{}).values():
                for location in locations:
                    i=location['start'];n=location['length'];template[i:i+n]=b'\0'*n;observed[i:i+n]=b'\0'*n
            assert template==observed,'runtime identity mismatch'
            if step['name']=='VerifiedGateway420':
                slots={}
                for item in a['storageLayout']['storage']:
                    key='0x'+int(item['slot']).to_bytes(32,'big').hex();value=node.rpc('eth_getStorageAt',[actual,key,'latest']);assert int(value,16)==0,'disabled gateway constructor storage'
                    slots[key]=value
                node.rpc('anvil_setCode',[pkg.GATEWAY,runtime]);actual=pkg.GATEWAY
                pkg.write(output/'gateway-genesis-allocation.json',{'schema':'420-bridge-constructor-materialization-v1','test_only':True,'genesis_config_hash':config,'governance':gov,'registry':pkg.REGISTRY,'artifact_sha256':records[step['name']]['artifact_sha256'],'constructor_receipt':receipt,'alloc':{actual:{'code':runtime,'storage':slots,'balance':'0x0'}}})
                assert decode(['address'],node.call(actual,'verifier()'))[0]==ZERO
            assert decode(['address'],node.call(actual,'registry()'))[0]==pkg.REGISTRY
            assert decode(['address'],node.call(actual,'governanceTimelock()'))[0]==gov.lower()
            assert node.call(actual,'genesisConfigHash()')==bytes.fromhex(config[2:])
            component=node.call(actual,'componentId()')
            data=keccak(b'registerComponent(bytes32,address,(uint16,uint16,uint16),uint8)')[:4]+encode(['bytes32','address','(uint16,uint16,uint16)','uint8'],[component,actual,(1,0,0),2])
            assert actual.lower()==step['address'].lower(),'predicted deployment address'
            pub=step['publication_transaction'];assert pub['data']=='0x'+data.hex()
            node.transact(gov,pub['data'],pkg.REGISTRY,nonce=pub['nonce'])
            assert decode(['address'],node.call(pkg.REGISTRY,'resolve(bytes32)',['bytes32'],[component]))[0]==actual.lower()
            assert node.call(pkg.REGISTRY,'runtimeCodeHash(bytes32)',['bytes32'],[component])==keccak(bytes.fromhex(runtime[2:]))
            deployments.append({'name':step['name'],'address':actual,'component_id':'0x'+component.hex(),'runtime_keccak256':'0x'+keccak(bytes.fromhex(runtime[2:])).hex(),'transaction_hash':receipt['transactionHash']});deployed[step['name']]=actual
        passed('ten core constructors, immutables, canonical publication and exact runtime identity')
        passed('frozen gateway constructor state exported with disabled verifier and no approvals')
        # Custody construction must resolve a published qualification registry. Only the existing
        # test-only always-reverting outcome fixture is used; never a production deployment input.
        fixture=pkg.ROOT/'contracts/test/BridgeDeploymentBinding420.t.sol';sources=pkg.closure([fixture])
        request={'language':'Solidity','sources':sources,'settings':{'evmVersion':'cancun','optimizer':{'enabled':True,'runs':200},'viaIR':True,'outputSelection':{'contracts/test/BridgeDeploymentBinding420.t.sol':{'DisabledBridgePublicationOutcome420':['evm.bytecode']}}}}
        response=json.loads(subprocess.check_output([solc,'--standard-json'],input=json.dumps(request),text=True));assert not [e for e in response.get('errors',[]) if e['severity']=='error']
        code=response['contracts']['contracts/test/BridgeDeploymentBinding420.t.sol']['DisabledBridgePublicationOutcome420']['evm']['bytecode']['object']
        outcome=node.transact(gov,'0x'+code)['contractAddress'];custody,receipt=deploy('BridgeValueCustody420',['address','address','bytes32','address'],[gov,pkg.REGISTRY,bytes.fromhex(config[2:]),outcome])
        assert decode(['address'],node.call(custody,'qualificationAnchor()'))[0]==deployed['BridgeVerifierRegistry420'].lower()
        assert node.call(custody,'qualificationRuntime()')==keccak(bytes.fromhex(node.rpc('eth_getCode',[deployed['BridgeVerifierRegistry420'],'latest'])[2:]))
        assert decode(['address'],node.call(custody,'deploymentAddress()'))[0]==custody.lower()
        component=node.call(custody,'componentId()');data=keccak(b'registerComponent(bytes32,address,(uint16,uint16,uint16),uint8)')[:4]+encode(['bytes32','address','(uint16,uint16,uint16)','uint8'],[component,custody,(1,0,0),2]);node.transact(gov,'0x'+data.hex(),pkg.REGISTRY)
        assert node.call(deployed['BridgeVerifierRegistry420'],'currentApproval(address)',['address'],[custody])==b'\0'*32
        deployments.append({'name':'BridgeValueCustody420','address':custody,'test_only_outcome':outcome,'transaction_hash':receipt['transactionHash']});passed('custody ordered after canonical qualification registry; publication grants no economic approval')
        for name in sorted(pkg.LEGACY):
            address,_=deploy(name,[],[])
            for signature,types,values in [('verifyInbound(bytes)',['bytes'],[b'']),('initiateOutbound(bytes32,bytes32,address,bytes,uint256,bytes)',['bytes32','bytes32','address','bytes','uint256','bytes'],[b'1'*32,b'2'*32,gov,b'\x01',1,b''])]:
                try:node.call(address,signature,types,values)
                except ValueError:pass
                else:raise AssertionError('legacy adapter executed')
        passed('both legacy placeholders reject inbound and outbound execution')
        for target,signature,types,values in [(deployed['GatewayRouter420'],'setAdapter(bytes32,address)',['bytes32','address'],[b'a'*32,outcome]),(deployed['BridgeRouteRegistry'],'setDirection(bytes32,bool,bool)',['bytes32','bool','bool'],[b'r'*32,True,True])]:
            try:node.call(target,signature,types,values,sender=stranger)
            except ValueError:pass
            else:raise AssertionError('unauthorized governance operation')
        passed('unauthorized adapter installation and direction activation reject')
        for target in [d['address'] for d in deployments]:
            assert node.call(deployed['BridgeVerifierRegistry420'],'currentApproval(address)',['address'],[target])==b'\0'*32
        passed('deployment and publication leave every core approval empty')
        result={'pass':True,'chain_id':31337,'environment':'fresh owned Anvil; controlled governance/configuration/outcome, not source authority','package_manifest_sha256':pkg.sha((package/'manifest.json').read_bytes()),'checks':checks,'deployments':deployments,'source_fixture_sha256':{k:pkg.sha(v['content'].encode()) for k,v in sources.items()},'anvil_version':subprocess.check_output([anvil,'--version'],text=True).strip(),'production_approvals':[]}
        pkg.write(output/'RESULTS.json',result);print(json.dumps({'pass':True,'checks':len(checks),'core_deployments':len(deployments)}))
    finally:node.close()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);p.add_argument('--anvil',required=True);p.add_argument('--solc',required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();run(a.package,a.anvil,a.solc,a.output)
