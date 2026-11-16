#!/usr/bin/env python3
"""Check production deployment sizes for changed token-route contracts, not test harness limits."""
from pathlib import Path
import argparse,hashlib,json,re,subprocess
ROOT=Path(__file__).resolve().parents[1]
TARGETS={'contracts/src/bridge/BridgeAssetRegistry.sol':'BridgeAssetRegistry','contracts/src/bridge/EthereumDepositGateway420.sol':'EthereumDepositGateway420',**{'contracts/src/bridge/adapters/'+name+'BridgeAdapter420.sol':name+'BridgeAdapter420' for name in ['Ethereum','Solana','Bnb']}}
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--solc',default='solc');args=parser.parse_args();pending=[ROOT/p for p in TARGETS];sources={}
    while pending:
        path=pending.pop();rel=path.relative_to(ROOT).as_posix()
        if rel in sources:continue
        content=path.read_text();sources[rel]={'content':content}
        for dependency in re.findall(r'(?:from\s+|import\s+)"([^"]+)"',content):pending.append((path.parent/dependency).resolve())
    request={'language':'Solidity','sources':sources,'settings':{'optimizer':{'enabled':True,'runs':200},'viaIR':True,'evmVersion':'cancun','outputSelection':{'*':{'*':['evm.deployedBytecode.object']}}}}
    proc=subprocess.run([args.solc,'--standard-json'],input=json.dumps(request),capture_output=True,text=True,check=True);result=json.loads(proc.stdout)
    errors=[x for x in result.get('errors',[]) if x['severity']=='error']
    if errors:raise RuntimeError(json.dumps(errors))
    sizes={}
    for path,contract in TARGETS.items():
        runtime=bytes.fromhex(result['contracts'][path][contract]['evm']['deployedBytecode']['object'])
        if len(runtime)>24576:raise ValueError('EIP170 exceeded: '+contract)
        sizes[contract]={'runtime_bytes':len(runtime),'runtime_sha256':hashlib.sha256(runtime).hexdigest()}
    print(json.dumps({'pass':True,'compiler_version':subprocess.check_output([args.solc,'--version'],text=True).strip(),'evm':'cancun','via_ir':True,'optimizer_runs':200,'contracts':sizes,'qualified_source_sha256':{p:hashlib.sha256(v['content'].encode()).hexdigest() for p,v in sources.items()}},indent=2))
if __name__=='__main__':main()
