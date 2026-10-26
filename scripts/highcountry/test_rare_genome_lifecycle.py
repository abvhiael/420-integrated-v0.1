import copy
import json
from pathlib import Path
import tempfile
import unittest
import common_reference_genomes as g
import rare_genome_lifecycle as r
import seed_registration_rpc as live

PAIRS,CATALOG,COMMONS=r.inputs()
PLAN=g.load('rare-breeding-plan.v1.json')

def config():
    return {'schema':'HC.SEED.REGISTRATION_RUNTIME.V1','state':'APPROVED_DEPLOYMENT','chainId':42001,'operator':'0x'+'11'*20,'profileId':g.k(b'profile'),'confirmations':2,'randomnessPolicy':{'minimumSecurityTier':2,'approvedRoutes':[{'routeId':g.k(b'route'),'methodId':g.k(b'vrf'),'operator':'0x'+'22'*20,'verifier':'0x'+'33'*20,'verifierCodeHash':g.k(b'verifier')}]},'contracts':{n:{'address':'0x'+format(i+1,'040x'),'codeHash':g.k(b'contract')} for i,n in enumerate(live.NAMES)}}

class RarePlanTests(unittest.TestCase):
    def test_all_26_owner_pairs_resolve_to_23_common_references(self):
        self.assertEqual(r.validate(PLAN,PAIRS,CATALOG,COMMONS)['rareCrosses'],26)
        self.assertEqual(len({x['breedingEventId'] for x in PLAN['events']}),26)
        self.assertTrue(all(e['entropy'] is None and e['loci'] is None for e in PLAN['events']))
    def test_renamed_rares_preserve_approved_parents(self):
        expected={'Blue Moon':['Blueberry','Northern Lights'],'Spirit Bear':['White Widow','Blueberry'],'Crow Mother':['Granddaddy Purple','Chemdawg']}
        names={e['id']:e['name'] for e in CATALOG['cultivars']}
        for pair in PAIRS['pairs']:
            if pair['canonicalName'] in expected:self.assertEqual([names[pair['parentA']],names[pair['parentB']]],expected[pair['canonicalName']])
    def test_plan_reproducibility(self):self.assertEqual(r.generate(PAIRS,CATALOG,COMMONS),PLAN)
    def test_same_parent_rejects(self):
        p=copy.deepcopy(PAIRS);p['pairs'][0]['parentB']=p['pairs'][0]['parentA']
        with self.assertRaises(ValueError):r.generate(p,CATALOG,COMMONS)
    def test_founder_as_parent_rejects(self):
        p=copy.deepcopy(PAIRS);p['pairs'][0]['parentA']='HC-F01'
        with self.assertRaises(ValueError):r.generate(p,CATALOG,COMMONS)
    def test_missing_duplicate_and_renamed_rare_reject(self):
        for mode in ['missing','duplicate','renamed']:
            p=copy.deepcopy(PAIRS)
            if mode=='missing':p['pairs'].pop()
            elif mode=='duplicate':p['pairs'][1]=p['pairs'][0]
            else:p['pairs'][0]['canonicalName']='Harvest Moon'
            with self.subTest(mode=mode),self.assertRaises(ValueError):r.generate(p,CATALOG,COMMONS)
    def test_tampered_plan_cannot_be_qualified(self):
        for field in ['childGenomeId','metadataHash','contextHash','localRequestId','breedingEventId','entropy','loci']:
            p=copy.deepcopy(PLAN);p['events'][0][field]=g.k(b'fabricated') if field in ['entropy','loci'] else None
            with self.subTest(field=field),self.assertRaises(ValueError):r.validate(p,PAIRS,CATALOG,COMMONS)
    def test_recombination_deterministic_with_both_parents_and_mutation(self):
        a,b=COMMONS['genomes'][0]['loci'],COMMONS['genomes'][1]['loci']
        loci,trace=r.offspring(a,b,g.k(b'entropy'),123)
        self.assertEqual((loci,trace),r.offspring(a,b,g.k(b'entropy'),123))
        self.assertEqual(len(loci),28);self.assertEqual({x['parent'] for x in trace},{'A','B'})
    def test_zero_entropy_rejects(self):
        with self.assertRaises(ValueError):r.offspring(COMMONS['genomes'][0]['loci'],COMMONS['genomes'][1]['loci'],live.ZERO,1)
    def test_request_context_changes_for_each_bound_field(self):
        e=PLAN['events'][0];args=[e['breedingEventId'],e['parentAGenomeId'],e['parentBGenomeId'],e['childGenomeId'],e['childLineId'],e['metadataHash']]
        for i in range(6):
            changed=args[:];changed[i]=args[i]+1 if i==0 else g.k(b'changed')
            self.assertNotEqual(r.context(*changed),e['contextHash'])
    def test_child_ids_not_chosen_after_entropy(self):
        self.assertTrue(all(e['status']=='PLANNED_NO_ENTROPY_OR_REGISTRATION' for e in PLAN['events']))
        self.assertEqual(len({e['childGenomeId'] for e in PLAN['events']}),26)

class LiveBoundaryTests(unittest.TestCase):
    def test_unresolved_runtime_rejects_before_network(self):
        with self.assertRaises(ValueError):live.validate_runtime(g.load('seed-registration-runtime.v1.json'))
    def test_explicit_runtime_validation(self):self.assertEqual(live.validate_runtime(config())['chainId'],42001)
    def test_chain_profile_operator_code_and_finality_required(self):
        for field,value in [('chainId',None),('profileId',live.ZERO),('operator','0x'+'00'*20),('confirmations',1)]:
            c=config();c[field]=value
            with self.subTest(field=field),self.assertRaises((ValueError,TypeError)):live.validate_runtime(c)
        c=config();c['contracts']['GenomeRegistry']['codeHash']=live.ZERO
        with self.assertRaises(ValueError):live.validate_runtime(c)
    def test_journal_cannot_change_chain_or_plan(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'journal.json';life=live.Lifecycle(config(),None,COMMONS,PLAN,path);life.persist()
            c=config();c['chainId']+=1
            with self.assertRaises(ValueError):live.Lifecycle(c,None,COMMONS,PLAN,path)
    def test_wrong_chain_preflight_rejects(self):
        with tempfile.TemporaryDirectory() as d:
            life=live.Lifecycle(config(),lambda m,p:'0x1',COMMONS,PLAN,Path(d)/'journal.json')
            with self.assertRaisesRegex(ValueError,'wrong chain'):life.preflight()
    def test_code_hash_mismatch_rejects(self):
        def rpc(m,p):return {'eth_chainId':hex(42001),'eth_blockNumber':'0x10','eth_getCode':'0x6000'}[m]
        with tempfile.TemporaryDirectory() as d:
            life=live.Lifecycle(config(),rpc,COMMONS,PLAN,Path(d)/'journal.json')
            with self.assertRaisesRegex(ValueError,'untrusted code'):life.preflight()
    def test_confirmation_and_reorg_validation(self):
        rec={'status':'0x1','blockNumber':'0xa','blockHash':'0xabc'}
        def rpc(m,p):return {'eth_getTransactionReceipt':rec,'eth_getBlockByNumber':{'hash':'0xabc'},'eth_blockNumber':'0xa'}[m]
        with tempfile.TemporaryDirectory() as d:
            life=live.Lifecycle(config(),rpc,COMMONS,PLAN,Path(d)/'journal.json')
            self.assertIsNone(life.receipt('tx'))
            life.rpc=lambda m,p:({'eth_getTransactionReceipt':rec,'eth_getBlockByNumber':{'hash':'0xabc'},'eth_blockNumber':'0xb'}[m])
            self.assertEqual(life.receipt('tx'),rec)
            life.rpc=lambda m,p:({'eth_getTransactionReceipt':rec,'eth_getBlockByNumber':{'hash':'0xdef'},'eth_blockNumber':'0xb'}[m])
            with self.assertRaisesRegex(ValueError,'reorganized'):life.receipt('tx')
    def test_reverted_transaction_rejects(self):
        with tempfile.TemporaryDirectory() as d:
            life=live.Lifecycle(config(),lambda m,p:{'status':'0x0'},COMMONS,PLAN,Path(d)/'j')
            with self.assertRaisesRegex(ValueError,'reverted'):life.receipt('tx')
    def test_dry_run_never_sends(self):
        def no_rpc(m,p):raise AssertionError('dry run used RPC')
        with tempfile.TemporaryDirectory() as d:
            life=live.Lifecycle(config(),no_rpc,COMMONS,PLAN,Path(d)/'j')
            tx=life.send('BreedingEngine','finalizeBreeding(uint64)',[r.word(1)])
            self.assertIn('unsignedTransaction',tx);self.assertFalse((Path(d)/'j').exists())
    def test_transaction_resume_does_not_resubmit(self):
        calls=[];c=config()
        def rpc(m,p):
            calls.append(m)
            if m=='eth_call':return '0x'
            if m=='eth_sendTransaction':return '0x'+'22'*32
            if m=='eth_getTransactionReceipt':return {'status':'0x1','blockNumber':'0xa','blockHash':'0xabc'}
            if m=='eth_getBlockByNumber':return {'hash':'0xabc'}
            if m=='eth_blockNumber':return '0xb'
            if m=='eth_getTransactionByHash':return {'from':c['operator'],'to':c['contracts']['BreedingEngine']['address'],'input':live.calldata('finalizeBreeding(uint64)',[r.word(1)])}
            raise AssertionError(m)
        with tempfile.TemporaryDirectory() as d:
            life=live.Lifecycle(c,rpc,COMMONS,PLAN,Path(d)/'j')
            life.send('BreedingEngine','finalizeBreeding(uint64)',[r.word(1)],True)
            life=live.Lifecycle(c,rpc,COMMONS,PLAN,Path(d)/'j')
            life.send('BreedingEngine','finalizeBreeding(uint64)',[r.word(1)],True)
            self.assertEqual(calls.count('eth_sendTransaction'),1)
    def test_unknown_event_transport_errors_are_not_absence(self):
        def rpc(m,p):raise RuntimeError('network down')
        with tempfile.TemporaryDirectory() as d:
            life=live.Lifecycle(config(),rpc,COMMONS,PLAN,Path(d)/'j')
            with self.assertRaisesRegex(RuntimeError,'network down'):life.event(PLAN['events'][0])

if __name__=='__main__':unittest.main()
