import json,unittest,struct
from pathlib import Path
from consensus import *
from fixtures import proof,state,leaf,PROOF
from eth_abi import encode,decode
F=Path(__file__).resolve().parents[2]/'contracts/test/fixtures/dobbscoin'
class AuxWireTests(unittest.TestCase):
    def setUp(self):self.r=json.loads((F/'native-regtest-auxpow.json').read_text());self.raw=bytes.fromhex(self.r['block'])
    def test_native_trailer_round_trip(self):
        a,end=read_aux(self.raw);n,at=cs(self.raw,end);self.assertEqual(n,1);t,at=tx(self.raw,at);self.assertEqual(at,len(self.raw));self.assertEqual(t['id'],self.raw[36:68]);check_aux(self.raw[:80],a['coinbase'],a['parent_header'],a['parent_branch'],a['chain_branch'],a['chain_index'],a['parent_index'],limit=(1<<255)-1)
    def test_truncated_aux_trailer_rejected(self):
        for size in [80,90,len(self.raw[:80])+len(bytes.fromhex(self.r['auxpow']))-1]:
            with self.assertRaises(ValueError):read_aux(self.raw[:size])
    def test_sdk_work_header_is_parent_not_child(self):
        a,end=read_aux(self.raw);s={'header':self.r['child_header'],'work_header':self.r['parent_header'],'auxpow':aux_json(a),'height':2000000,'block_hash':dsha(self.raw[:80])[::-1].hex(),'scrypt_hash':self.r['scrypt_hash'],'parent_work':'0x1','chain_work':'0x2','expected_bits':0x1e0fffff,'parent_time':0,'median_time_past':0}
        p=proof(s);self.assertEqual(p[0][6],sha256(a['parent_header']).digest());self.assertEqual(p[4][0],a['coinbase']);self.assertEqual(decode([PROOF],encode([PROOF],[p]))[0][0],state(s))
    def test_parent_branch_no_invented_32_level_cap(self):
        a,end=read_aux(self.raw);parent=bytearray(a['parent_header']);root=dsha(a['coinbase']);siblings=[bytes(32)]*33
        for sibling in siblings:root=dsha(root+sibling)
        parent[36:68]=root;nonce=0
        while int.from_bytes(pow_hash(bytes(parent)),'little')>target(bits(self.raw[:80]),(1<<255)-1):nonce+=1;struct.pack_into('<I',parent,76,nonce)
        check_aux(self.raw[:80],a['coinbase'],bytes(parent),siblings,[],0,limit=(1<<255)-1)
if __name__=='__main__':unittest.main()
