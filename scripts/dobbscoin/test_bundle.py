import copy,json,unittest
from pathlib import Path
from eth_abi import decode
from bundle import build,signing_digest
from fixtures import PROOF,leaf
from consensus import SOURCE,GENESIS
ROOT=Path(__file__).resolve().parents[2]
class BundleTests(unittest.TestCase):
    def setUp(self):
        self.history=json.loads((ROOT/'contracts/test/fixtures/dobbscoin/historical.json').read_text());r=self.history
        self.native={'source':SOURCE,'created_fresh_from_raw_only':True,'assumevalid':'0','connections':0,'checkpoints_disabled':True,'chain':{'chain':'main','blocks':r['height'],'bestblockhash':r['tip'],'chainwork':r['chain_work']},'selected':{'0':{'hash':GENESIS}}}
    def test_every_merkle_record_matches_root(self):
        b=build(self.history,self.native);self.assertEqual(len(b['proofs']),28)
        for raw in b['proofs']:
            p=decode([PROOF],bytes.fromhex(raw[2:]))[0];root=leaf(p[0]);index=p[1]
            from hashlib import sha256
            for sibling in p[2]:root=sha256(sibling+root if index&1 else root+sibling).digest();index//=2
            self.assertEqual('0x'+root.hex(),b['root']);self.assertEqual(index,0)
    def test_rpc_only_rejected(self):
        for data in [{'confirmations':288,'finalized':True},{'source':SOURCE,'chain':self.native['chain']}]:
            with self.assertRaises(ValueError):build(self.history,data)
    def test_incomplete_or_wrong_native_replay_rejected(self):
        for key,value in [('source','wrong'),('created_fresh_from_raw_only',False),('assumevalid','1'),('connections',1)]:
            n=copy.deepcopy(self.native);n[key]=value
            with self.assertRaises(ValueError):build(self.history,n)
    def test_selected_chain_disagreement_rejected(self):
        for key,value in [('chain','test'),('blocks',1),('bestblockhash','00'*32),('chainwork','0')]:
            n=copy.deepcopy(self.native);n['chain'][key]=value
            with self.assertRaises(ValueError):build(self.history,n)
    def test_signature_domain_separation(self):
        b=build(self.history,self.native);a='0x'+'11'*20;pred='0x'+'22'*32;d=signing_digest(b,420,a,1,pred)
        self.assertNotEqual(d,signing_digest(b,421,a,1,pred));self.assertNotEqual(d,signing_digest(b,420,'0x'+'12'*20,1,pred));self.assertNotEqual(d,signing_digest(b,420,a,2,pred));self.assertNotEqual(d,signing_digest(b,420,a,1,'0x'+'23'*32))
    def test_unqualified_checkpoint_signature_shortcut_rejected(self):
        self.native.pop('checkpoints_disabled')
        with self.assertRaises(ValueError):build(self.history,self.native)
    def test_complete_checkpoint_script_complement_accepted(self):
        self.native.pop('checkpoints_disabled');self.native['script_validation']={'source':SOURCE,'first_height':1,'last_height':1847999,'native_checkpoint_height':1848000,'headers_sha256':self.history['headers_sha256'],'verified_inputs':1,'tampered_historical_signature_rejected':True}
        self.assertEqual(len(build(self.history,self.native)['proofs']),28)
    def test_archive_member_filter(self):
        from acquire import raw_member
        self.assertTrue(raw_member('blocks/blk00000.dat'))
        for name in ['blocks/index/blk00000.dat','../blocks/blk00000.dat','chainstate/000001.ldb','wallet.dat','blocks/rev00000.dat']:
            self.assertFalse(raw_member(name))
if __name__=='__main__':unittest.main()
