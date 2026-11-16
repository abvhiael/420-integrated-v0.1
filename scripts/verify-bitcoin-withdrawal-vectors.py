#!/usr/bin/env python3
"""Independent stdlib serialization/hash vectors; synthetic, never signatures or mined evidence."""
import hashlib,json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];F=ROOT/'contracts/test/fixtures/bitcoin/withdrawal-v1'
def dsha(b):return hashlib.sha256(hashlib.sha256(b).digest()).digest()
def tx(script=b'',witness=False):
 prev=bytes(range(1,33))+struct.pack('<I',7)
 inputs=b'\x01'+prev+bytes([len(script)])+script+struct.pack('<I',0xfffffffd)
 scripts=[b'\x51\x20'+bytes([0x21])*32,b'\x6a\x20'+bytes([0x42])*32,b'\x00\x20'+bytes([0x63])*32]
 outputs=b'\x03'+b''.join(struct.pack('<Q',v)+bytes([len(s)])+s for v,s in zip([1000,0,8900],scripts))
 return struct.pack('<I',2)+(b'\x00\x01' if witness else b'')+inputs+outputs+(b'\x01\x02\xab\xcd' if witness else b'')+struct.pack('<I',0)
def expected():
 u=tx();l=tx(b'\x01\x30');w=tx(witness=True)
 return {'kind':'synthetic public signing serialization; no valid signature/custody or historical block claim','unsigned_hex':u.hex(),'legacy_hex':l.hex(),'segwit_hex':w.hex(),'unsigned_txid':dsha(u).hex(),'legacy_txid':dsha(l).hex(),'segwit_txid':dsha(u).hex(),'segwit_wtxid':dsha(w).hex(),'script_sig_and_witness_stripped_skeleton':dsha(u).hex()}
def main():
 e=expected();stored=json.loads((F/'vectors.json').read_text());assert stored==e
 for key in ['unsigned','legacy','segwit']:assert (F/(key+'.hex')).read_text()=='0x'+e[key+'_hex']
 assert e['legacy_txid']!=e['unsigned_txid'] and e['segwit_txid']!=e['segwit_wtxid']
 print(json.dumps({'pass':True,'synthetic_vectors':3,'reference':'Python stdlib struct and hashlib SHA256d','segwit_txid_differs_from_wtxid':True}))
if __name__=='__main__':main()
