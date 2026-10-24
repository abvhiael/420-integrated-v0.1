#!/usr/bin/env python3
"""Prepare genuine inherited verifier code and exact VK bytes for WS8 context export.
This does not admit any proof or certify a funded hand.
"""
import hashlib,json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
if '--committed' in sys.argv:
 import shutil,subprocess
 subprocess.run([sys.executable,str(ROOT/'scripts/bet/package-ws8-evidence.py'),'--verify'],check=True)
 bundle=ROOT/'clients/420bet-poker/zkshuffle/fixtures/ws8'
 target=ROOT/'artifacts/contracts/ws8';target.mkdir(parents=True,exist_ok=True)
 for p in (bundle/'keys').glob('*.vk'):shutil.copyfile(p,target/p.name)
 for name in ['rounds.bin','context.bin','context.json']:shutil.copyfile(bundle/name,target/name)
 shutil.copytree(bundle/'proofs',target/'proofs',dirs_exist_ok=True)
 print('Prepared checksum-verified committed genuine proof fixtures')
 raise SystemExit(0)
ws2=ROOT/'artifacts/420bet-ws2';ws3=ROOT/'artifacts/420bet-ws3'
out=ROOT/'contracts/src/bet/generated';out.mkdir(parents=True,exist_ok=True)
data=ROOT/'artifacts/contracts/ws8';data.mkdir(parents=True,exist_ok=True)
items=[
 ('InitialDeck52',ws2,'EXPERIMENTAL-InitialDeck52','VK','initial_deck_circuit.go',5),
 ('Reencrypt52',ws2,'EXPERIMENTAL-Reencrypt52','VerifyingKey','reencryption_circuit.go',6),
 ('Delivery',ws3,'EXPERIMENTAL-WS3FullDelivery','VK','encrypted_share_delivery_circuit.go',18),
 ('RecipientPoP',ws3,'EXPERIMENTAL-WS3FullRecipientPoP','VK','recipient_key_possession_circuit.go',3),
 ('Aggregate',ws3,'EXPERIMENTAL-WS3FullAggregate','VK','threshold_key_aggregate_circuit.go',7),
 ('Partial',ws2,'EXPERIMENTAL-PartialShare','VK','partial_decryption_circuit.go',13),
 ('Unmask',ws2,'EXPERIMENTAL-CardUnmask','VK','card_unmask_circuit.go',17),
]
manifest=[];funcs=[]
for i,(name,folder,prefix,vk,circuit,n) in enumerate(items):
 material=ROOT/'artifacts/contracts/ws8-material' if '--material' in sys.argv else None
 source_path=material/(name+'.sol') if material else folder/(prefix+'Verifier.sol')
 source=source_path.read_text(encoding='utf-8')
 assert len(re.findall(r'contract Verifier\b',source))==1
 renamed=re.sub(r'contract Verifier\b','contract WS8'+name+'Verifier',source)
 (out/('WS8'+name+'Verifier.sol')).write_text(renamed,encoding='utf-8')
 key=(material/(name+'.vk') if material else folder/(prefix+vk+'.bin')).read_bytes();(data/(name+'.vk')).write_bytes(key)
 circuit_hash=hashlib.sha256((material/(name+'.r1cs') if material else ROOT/'clients/420bet-poker/zkshuffle'/circuit).read_bytes()).hexdigest()
 schema_hash=hashlib.sha256(('gnark-v0.14.0:BN254:'+name+':'+str(n)).encode()).hexdigest()
 funcs.append(f'if(i=={i})return (0x{circuit_hash},0x{schema_hash});')
 manifest.append(dict(name=name,source=str(source_path),verifierSHA256=hashlib.sha256(source.encode()).hexdigest(),vkSHA256=hashlib.sha256(key).hexdigest(),circuitSHA256=circuit_hash,publicInputs=n))
a=json.loads((ws3/'EXPERIMENTAL-WS3AggregateFixture.json').read_text())['public'][1:]
rounds=json.loads((ws2/'EXPERIMENTAL-Reencrypt52AvailabilityFixture.json').read_text())['roundConstants']
(data/'rounds.bin').write_bytes(b''.join(int(x).to_bytes(32,'big') for x in [32,len(rounds),*rounds]))
header='// SPDX-License-Identifier: GPL-3.0\npragma solidity ^0.8.24;\nlibrary WS8VerifierData {\n'
header+='function identity(uint8 i) internal pure returns(bytes32,bytes32){'+''.join(funcs)+'revert();}\n'
header+='function keys() internal pure returns(uint256[6] memory){return ['+','.join('uint256('+str(x)+')' for x in a)+'];}\n}\n'
(out/'WS8VerifierData.sol').write_text(header,encoding='utf-8')
(data/'inherited-verifier-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print('Prepared seven genuine generated verifiers and exact key bytes; no proof admission performed')
