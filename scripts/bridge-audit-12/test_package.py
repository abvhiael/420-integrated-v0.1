#!/usr/bin/env python3
"""Adversarial tests of the actual compiled package and unsigned deployment boundary."""
import copy, importlib.util, json, os, shutil, tempfile, unittest
from unittest.mock import patch
from pathlib import Path
from eth_hash.auto import keccak
spec=importlib.util.spec_from_file_location('package12',Path(__file__).with_name('package.py'));p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
PACKAGE=Path(os.environ['BRIDGE12_PACKAGE'])
class PackageTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.package=Path(self.temp.name)
        for f in ['manifest.json','configuration.json','compiler-input.json']:shutil.copyfile(PACKAGE/f,self.package/f)
        (self.package/'artifacts').mkdir()
        for name in ['VerifiedGateway420','GatewayRouter420','BridgeValueCustody420','BridgeVerifierRegistry420','ETHProofAdapter','BTCLightClientAdapter','ProtocolRegistry']:
            shutil.copyfile(PACKAGE/'artifacts'/f'{name}.json',self.package/'artifacts'/f'{name}.json')
        self.gov='0x'+'11'*20;self.config='0x'+'22'*32
        self.params={'environment':'local_rehearsal','chain_id':31337,'registry':p.REGISTRY,'governance':self.gov,'genesis_config_hash':self.config,'deployer':self.gov,'start_nonce':0,'contracts':[{'name':'VerifiedGateway420','args':[self.gov,p.REGISTRY,self.config,'0x'+'00'*20]},{'name':'GatewayRouter420','args':[self.gov,p.REGISTRY,self.config]}]}
    def tearDown(self):self.temp.cleanup()
    def plan(self):return p.make_plan(self.package,self.params)
    def rejects(self,pattern):
        with self.assertRaisesRegex((AssertionError,KeyError,ValueError,TypeError),pattern):self.plan()
    def test_deterministic_frozen_and_create_plan(self):
        first=self.plan();self.assertEqual(first,self.plan());self.assertNotIn('transaction',first['steps'][0]);self.assertEqual(first['steps'][0]['address'],p.GATEWAY)
        self.assertEqual(first['steps'][0]['publication_transaction']['nonce'],0);self.assertEqual(first['steps'][1]['transaction']['nonce'],1);self.assertEqual(first['steps'][1]['publication_transaction']['nonce'],2)
        self.assertFalse(first['routes_active']);self.assertEqual(first['production_approvals'],[])
    def test_create_address_known_evm_vector(self):
        self.params['deployer']='0x6ac7ea33f8831ea9dcc53393aaa88b25a785dbf0';self.params['contracts']=self.params['contracts'][1:]
        self.assertEqual(self.plan()['steps'][0]['address'],'0xcd234a471b72ba2f1ccf0a70fcaba648a5eecd8d')
    def test_wrong_registry_rejected(self):self.params['registry']=self.gov;self.rejects('noncanonical Registry')
    def test_wrong_constructor_registry_rejected(self):self.params['contracts'][1]['args'][1]=self.gov;self.rejects('constructor Registry')
    def test_wrong_constructor_governance_rejected(self):self.params['contracts'][1]['args'][0]=p.REGISTRY;self.rejects('constructor governance')
    def test_wrong_constructor_config_rejected(self):self.params['contracts'][1]['args'][2]='0x'+'33'*32;self.rejects('constructor configuration')
    def test_active_frozen_gateway_rejected(self):self.params['contracts'][0]['args'][-1]=self.gov;self.rejects('must start disabled')
    def test_legacy_placeholder_plans_rejected(self):
        for name in p.LEGACY:
            with self.subTest(name=name):
                self.params['contracts']=[{'name':name,'args':[]}];self.rejects('ineligible deployment')
    def test_foreign_registry_deployment_rejected(self):self.params['contracts']=[{'name':'ProtocolRegistry','args':[self.gov]}];self.rejects('ineligible deployment')
    def test_duplicate_deployment_rejected(self):self.params['contracts'].append(self.params['contracts'][1]);self.rejects('duplicate deployment')
    def test_custody_dependency_order_rejected(self):self.params['contracts']=[{'name':'BridgeValueCustody420','args':[self.gov,p.REGISTRY,self.config,self.gov]}];self.rejects('published qualification registry')
    def test_artifact_tampering_rejected(self):
        f=self.package/'artifacts/GatewayRouter420.json';obj=json.loads(f.read_text());obj['evm']['bytecode']['object']='00';p.write(f,obj);self.rejects('artifact drift')
    def test_configuration_tampering_rejected(self):self.package.joinpath('configuration.json').write_text('{}');self.rejects('configuration drift')
    def test_compiler_input_tampering_rejected(self):self.package.joinpath('compiler-input.json').write_text('{}');self.rejects('compiler input drift')
    def test_source_drift_rejected(self):
        f=self.package/'manifest.json';obj=json.loads(f.read_text());obj['sources']['contracts/src/bridge/GatewayRouter420.sol']='0'*64;p.write(f,obj);self.rejects('source drift')
    def test_invalid_chain_and_nonce_rejected(self):
        for key,value in [('chain_id',0),('chain_id',True),('start_nonce',-1)]:
            original=self.params[key];self.params[key]=value
            with self.subTest(key=key,value=value):self.rejects('chain id|nonce')
            self.params[key]=original
    def production(self):
        self.params.pop('environment');frozen=json.loads((p.ROOT/'contracts/config/genesis-config-commitment.json').read_text());self.params['governance']=frozen['commitmentPayload']['governanceTimelock'];self.params['genesis_config_hash']=frozen['genesisConfigHash']
        for entry in self.params['contracts']:
            entry['args'][0]=self.params['governance'];entry['args'][2]=self.params['genesis_config_hash']
        return frozen
    def test_production_plan_accepts_reconciled_frozen_authority(self):
        self.production();plan=self.plan();self.assertFalse(plan['routes_active']);self.assertEqual(plan['production_approvals'],[])
        self.assertNotIn('nonce',plan['steps'][0]['publication_transaction'])
        self.assertEqual(plan['steps'][1]['transaction']['nonce'],0)
    def authority_copy(self):
        frozen=json.loads((p.ROOT/'contracts/config/genesis-config-commitment.json').read_text());root=self.package/'authority'
        for path in ['contracts/config/genesis-config-commitment.json','contracts/config/system-addresses.json','contracts/config/genesis-canonical-addresses.json']+[x['path'] for x in frozen['commitmentPayload']['authorityInputs']]:
            target=root/path;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p.ROOT/path,target)
        return root
    def test_production_plan_rejects_frozen_authority_drift(self):
        frozen=self.production();root=self.authority_copy();(root/frozen['commitmentPayload']['authorityInputs'][0]['path']).write_text('{}')
        with patch.object(p,'ROOT',root):self.rejects('frozen authority drift')
    def test_production_plan_rejects_commitment_payload_tampering(self):
        self.production();root=self.authority_copy();f=root/'contracts/config/genesis-config-commitment.json';obj=json.loads(f.read_text());obj['commitmentPayload']['initializationVersion']=2;p.write(f,obj)
        with patch.object(p,'ROOT',root):self.rejects('frozen configuration commitment')
    def test_production_plan_rejects_retired_commitment_version(self):
        self.production();root=self.authority_copy();f=root/'contracts/config/genesis-config-commitment.json';obj=json.loads(f.read_text());obj['status']='FROZEN_V1';p.write(f,obj)
        with patch.object(p,'ROOT',root):self.rejects('noncanonical commitment version')
if __name__=='__main__':unittest.main(verbosity=2)
