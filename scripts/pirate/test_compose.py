import copy
import hashlib
import json
from pathlib import Path
import unittest
from eth_abi import encode,decode
from eth_hash.auto import keccak
from compose import compose,FIELDS,RECORD,PROOF,SOURCE,NETWORK,value

FIX=Path(__file__).resolve().parents[2]/'contracts/test/fixtures/pirate'
class CompositionTests(unittest.TestCase):
    def setUp(self):
        # Controlled authority fixture, never genuine mainnet deposit/finality.
        self.receipt=copy.deepcopy(json.loads((FIX/'controlled-evidence.json').read_text())['checks']['sapling']['receipt'])
        self.router='0x'+'11'*20;self.route='0x'+'22'*32;self.chain=420
        r={n:('0x'+'00'*32 if t=='bytes32' else '0x'+'00'*20 if t=='address' else 0) for n,t in FIELDS}
        r.update(genesis='027e3758c3a65b12aa1046462b486d0a63bfa1beae327897f56c5cfb7daaae71',source=SOURCE+'00'*12,height=3000000,chainWork=2,parentWork=1,notarizedHeight=3000001,validation=127)
        for f in ['blockHash','transactionHash','saplingRoot','notarizedHash','notarizationTransaction','notarySetHash','anchorEvidenceDigest','nativeExecutionDigest']:r[f]='33'*32
        for a,b in {'key_id':'gatewayKeyId','pool':'pool','output_index':'outputIndex','position':'notePosition','note_commitment':'noteCommitment','nullifier':'nullifier','root':'noteRoot','amount':'amount','recipient':'recipient','raw_sha256':'rawTransactionSha256'}.items():r[b]=self.receipt[a]
        r['saplingRoot']=r['noteRoot'];r['transactionHash']=bytes.fromhex(self.receipt['txid'])[::-1].hex()
        r['blockHash']=json.loads((FIX/'historical-inclusion.json').read_text())['block_hash'];r['chainWork']=7967024532
        header=bytes.fromhex((FIX/'historical-header.hex').read_text());r['headerSha256']=hashlib.sha256(header).hexdigest()
        domain=keccak(encode(['string','bytes32','uint256','address','bytes32','bytes32','uint8'],['420/ARRR/DEPOSIT/V1',NETWORK,self.chain,self.router,bytes.fromhex(self.route[2:]),bytes.fromhex(r['gatewayKeyId']),r['pool']]))
        # Mock bridge-domain plaintext only; not a claim to decrypt the genuine
        # public header's transactions. Native worker positives are separate.
        memo=b'420ARRR1'+domain+bytes.fromhex(r['recipient'])+r['amount'].to_bytes(8,'little')+bytes(444)
        self.receipt['memo']=memo.hex();r['memoHash']=hashlib.sha256(memo).hexdigest()
        self.e=dict(record=r,index=0,branch=[],header=header.hex(),transaction=(FIX/'controlled-sapling-v6.hex').read_text(),memo=memo.hex(),checkpoint_height=3000002,checkpoint_root='')
        self.reseal()
    def reseal(self):self.e['checkpoint_root']=hashlib.sha256(encode(['string',RECORD],['420/ARRR/NATIVE-SHIELDED-STATE/V1',tuple(value(self.e['record'],n,t) for n,t in FIELDS)])).hexdigest()
    def build(self):return compose(self.e,self.receipt,self.chain,self.router,self.route)
    def test_controlled_abi_round_trip(self):
        decoded=decode([PROOF],self.build())[0];self.assertEqual(decoded[0][2],3000000);self.assertEqual(decoded[4],bytes.fromhex(self.e['transaction']))
    def test_missing_worker_validation(self):
        self.receipt['ownership_validated']=False
        with self.assertRaises(ValueError):self.build()
    def test_root_substitution(self):
        self.e['checkpoint_root']='00'*32
        with self.assertRaises(ValueError):self.build()
    def test_transaction_substitution(self):
        self.e['transaction']='00'
        with self.assertRaises(ValueError):self.build()
    def test_domain_substitution(self):
        self.chain+=1
        with self.assertRaises(ValueError):self.build()
    def test_note_position_substitution(self):
        self.e['record']['notePosition']+=1;self.reseal()
        with self.assertRaises(ValueError):self.build()
    def test_raw_rpc_status_not_a_context(self):
        self.e['record']['validation']=0;self.reseal()
        with self.assertRaises(ValueError):self.build()
    def test_strict_notarization(self):
        self.e['record']['notarizedHeight']=3000000;self.reseal()
        with self.assertRaises(ValueError):self.build()
    def test_pool_substitution(self):
        self.e['record']['pool']=1;self.reseal()
        with self.assertRaises(ValueError):self.build()
    def test_nullifier_substitution(self):
        self.receipt['nullifier']='44'*32
        with self.assertRaises(ValueError):self.build()
    def test_native_block_work(self):
        self.e['record']['chainWork']+=1;self.reseal()
        with self.assertRaises(ValueError):self.build()
    def test_header_identity(self):
        self.e['record']['blockHash']='55'*32;self.reseal()
        with self.assertRaises(ValueError):self.build()
    def test_native_txid_endianness(self):
        self.e['record']['transactionHash']=self.receipt['txid'];self.reseal()
        with self.assertRaises(ValueError):self.build()
if __name__=='__main__':unittest.main()
