#!/usr/bin/env python3
"""Deterministic test-only validators and deposits. Never production credentials."""
import os
from pathlib import Path
os.chdir(Path(__file__).resolve().parents[2])
from pathlib import Path
import json,hashlib,base64,struct
from eth_abi import encode
from eth_hash.auto import keccak
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding,PublicFormat
r=Path('contracts/test/fixtures/solana');r.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).digest()
key=lambda n:Ed25519PrivateKey.from_private_bytes(sha(('420/SOLANA/CONTROLLED/TEST-ONLY/'+str(n)).encode()))
pub=lambda k:k.public_key().public_bytes(Encoding.Raw,PublicFormat.Raw)
genesis=bytes.fromhex('45296998a6f8e2a784db5d9f95e18fc23f70441a1039446801089879b08c7ef0')
address=lambda n:n.to_bytes(20,'big')
program=pub(key(500));code=sha(Path('contracts/solana/gateway/artifacts/solana_gateway_420.so').read_bytes());owner=key(42);ownerpub=pub(owner);quorum=address(0x7000);router=address(0x420420)
native=keccak(b'420/BRIDGE/SOLANA/NATIVE/SOL');token=bytes.fromhex('06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9')
def oncurve(raw):
 p=2**255-19;y=int.from_bytes(raw,'little')&((1<<255)-1);d=-121665*pow(121666,p-2,p)%p
 x2=(y*y-1)*pow((d*y*y+1)%p,p-2,p)%p
 return pow(x2,(p-1)//2,p) in (0,1)
def pda(seeds,program):
 for bump in range(255,-1,-1):
  v=sha(b''.join(seeds)+bytes([bump])+program+b'ProgramDerivedAddress')
  if not oncurve(v):return v
 raise ValueError('no PDA')
import base58
ata=base58.b58decode('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
routes={'native':keccak(b'420/BRIDGE/ROUTE/SOL/MAINNET'),'ray':keccak(b'420/BRIDGE/ROUTE/RAY/SOLANA/MAINNET'),'eurc':keccak(b'420/BRIDGE/ROUTE/EURC/SOLANA/MAINNET')}
mints={'native':native,'ray':bytes.fromhex(json.load(open('contracts/config/bridge/ray-solana-v12.5.23.json'))['asset']['solana_mint_bytes32'][2:]),'eurc':bytes.fromhex(json.load(open('contracts/config/bridge/eurc-solana-v12.5.22.json'))['asset']['solana_mint_bytes32'][2:])}
E='(bytes32,bytes32,uint64,bytes32,bytes32,bytes32,bytes32,address,uint64,uint64,uint256,address,bytes32,uint32,bool,bytes32[],bytes32[],bytes,uint32)';C='(uint64,uint64,bytes32,bytes32,bytes32)';V='(bytes32,bytes32,uint64,uint32,bytes32[],bytes)'
voters=sorted([(sha(b'vote account'+bytes([i])),key(i),w) for i,w in enumerate([40,30,20,10],1)])
leaves=[sha(encode(['bytes32','uint64','bytes32','bytes32','uint64'],[genesis,1086,v,pub(k),s])) for v,k,s in voters]
mid=[sha(leaves[i]+leaves[i+1]) for i in [0,2]];root=sha(b''.join(mid));snapshot=sha(b'controlled test snapshot, not Solana validator/stake evidence')
def sv(n):
 out=b''
 while n>=128:out+=bytes([(n&127)|128]);n>>=7
 return out+bytes([n])
for name,typ in [('native','legacy'),('native-v0','v0'),('native-v0-lut','v0-lut'),('native-v1','v1'),('ray','legacy'),('eurc','v1'),('native-bad-data','legacy'),('native-bad-owner','legacy'),('native-failed','legacy'),('native-conflicting-bank','legacy'),('ray-mint-substitution','legacy'),('native-v1-multisig','v1-multi'),('native-cpi','cpi'),('native-cpi-uncommitted','cpi')]:
 asset='native' if name.startswith('native') else ('ray' if name.startswith('ray') else name);amount=42000000;nonce=17
 state=pda([b'420-state',mints[asset]],program);vault=state if asset=='native' else pda([state,token,mints[asset]],ata)
 data=b'420SOLV1'+struct.pack('<Q',amount)+mints[asset]+address(0xB0B)+(420).to_bytes(32,'big')+router+routes[asset]+struct.pack('<Q',nonce)
 loadedw=[];loadedr=[];inner=b'';inner_index=0;source_owner=ownerpub
 if asset=='native':accounts=[ownerpub,vault,bytes(32),program];readonly=2;ixacc=bytes([0,1,2]);pi=3
 else:accounts=[ownerpub,vault,sha(b'controlled source token account'),state,mints[asset],token,program];readonly=3;ixacc=bytes([0,1,4,2,5,3]);pi=6
 if typ=='v0-lut':accounts=[ownerpub,bytes(32)];readonly=1;loadedw=[vault];loadedr=[program];pi=3;ixacc=bytes([0,2,1])
 if name=='ray-mint-substitution':accounts[4]=mints['eurc']
 if typ=='cpi':
  caller=pub(key(501));source_owner=pda([b'controlled-owner'],caller);accounts=[ownerpub,source_owner,vault,bytes(32),program,caller];readonly=3;pi=5;ixacc=bytes([1,2,3,4]);inner=encode(['(uint8,bytes,bytes)'],[(4,bytes([1,2,3]),data)])
 header=bytes([1,0,readonly]);lifetime=sha(b'controlled recent blockhash')
 if typ in ('v1','v1-multi'):
  msg=b'\x81'+header+struct.pack('<I',12)+lifetime+bytes([1,len(accounts)])+b''.join(accounts)+struct.pack('<II',1000000,1048576)+bytes([pi,len(ixacc)])+struct.pack('<H',len(data))+ixacc+data
  if typ=='v1-multi':
   co=[key(201+i) for i in range(11)];memo=base58.b58decode('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');accounts=[ownerpub]+[pub(k) for k in co]+[vault,bytes(32),program,memo]
   msg=b'\x81'+bytes([12,11,3])+struct.pack('<I',12)+lifetime+bytes([2,len(accounts)])+b''.join(accounts)+struct.pack('<II',1000000,1048576)+bytes([14,3])+struct.pack('<H',len(data))+bytes([15,0])+struct.pack('<H',2595)+bytes([0,12,13])+data+b'A'*2595
   raw=msg+b''.join(k.sign(msg) for k in [owner]+co);assert len(raw)==4096,len(raw)
  else:raw=msg+owner.sign(msg)
 else:
  msg=(b'\x80' if typ.startswith('v0') else b'')+header+sv(len(accounts))+b''.join(accounts)+lifetime+b'\x01'+bytes([pi])+sv(len(ixacc))+ixacc+sv(len(data))+data
  if typ=='v0':msg+=b'\x00'
  elif typ=='v0-lut':msg+=b'\x01'+sha(b'controlled LUT')+b'\x01\x07\x01\x09'
  raw=b'\x01'+owner.sign(msg)+msg
 execution=(genesis,sha(b'controlled finalized bank'),469440001,program,code,mints[asset],source_owner,address(0xB0B),amount,nonce,420,router,routes[asset],0,True,loadedw,loadedr,inner,inner_index)
 execution=list(execution)
 if name=='native-bad-data':execution[8]+=1
 if name=='native-bad-owner':execution[6]=pub(key(43))
 if name in ('native-failed','native-cpi-uncommitted'):execution[14]=False
 if name=='native-conflicting-bank':execution[1]=sha(b'conflicting bank')
 execution=tuple(execution)
 claim=(1086,469440001,execution[1],sha(raw),sha(encode([E],[execution])))
 digest=sha(encode(['string','bytes32','uint256','address',C,'bytes32','bytes32','uint64'],['420/SOLANA/VALIDATOR-ATTESTATION/V1',genesis,420,quorum,claim,root,snapshot,100]))
 votes=[]
 for i,(v,k,s) in enumerate(voters):votes.append((v,pub(k),s,i,[leaves[i^1],mid[(i//2)^1]],k.sign(digest)))
 (r/f'controlled-{name}.bin').write_bytes(encode(['('+E+',bytes)',C,V+'[]','bytes32','bytes32','bytes32','bytes32'],[(execution,raw),claim,votes,root,snapshot,vault,state]))
(r/'controlled-program-bindings.json').write_text(json.dumps({'program':program.hex(),'owner':ownerpub.hex(),'token_program':token.hex(),'ray_vault':pda([pda([b'420-state',mints['ray']],program),token,mints['ray']],ata).hex(),'eurc_vault':pda([pda([b'420-state',mints['eurc']],program),token,mints['eurc']],ata).hex(),'native_state':pda([b'420-state',native],program).hex(),'ray_state':pda([b'420-state',mints['ray']],program).hex(),'eurc_state':pda([b'420-state',mints['eurc']],program).hex()},indent=2)+'\n')
print('Controlled fixtures: actual Ed25519 signatures, test-only stake root; no mainnet finality claim')

lengths=[0,1,31,32,63,64,110,111,112,113,127,128,129,255,256,1024,1232,2048,4032,4096]
pks=[];msgs=[];sigs=[];hashes=[]
for n in lengths:
 k=Ed25519PrivateKey.from_private_bytes(sha(b"420/ED25519/CONTROL/"+str(n).encode()))
 msg=(hashlib.sha512(str(n).encode()).digest()*((n+63)//64))[:n]
 pks.append(pub(k));msgs.append(msg);sigs.append(k.sign(msg));hashes.append(hashlib.sha512(msg).digest())
(r/'crypto-vectors.bin').write_bytes(encode(['bytes32[]','bytes[]','bytes[]','bytes[]'],[pks,msgs,sigs,hashes]))
