import copy
import json
from pathlib import Path
import unittest
from eth_abi import decode
from eth_hash.auto import keccak
from cctp import *
from issuer_registry import eligibility
from verify_history import registry,verify

FIX=Path(__file__).resolve().parents[2]/'contracts/test/fixtures/cctp'
class CCTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.keys=json.loads((FIX/'issuer-public-keys.json').read_text());cls.deployments=registry()
    def setUp(self):
        self.raw=bytes.fromhex((FIX/'base-standard.message.hex').read_text());self.sig=bytes.fromhex((FIX/'base-standard.attestation.hex').read_text());self.message=parse_message(self.raw)
    def route_args(self):
        p=self.deployments['6'];return dict(local_domain=0,local_messenger='0x'+self.deployments['0']['token_messenger'][-40:],source_domain=6,source_messenger=p['token_messenger'],source_token=p['usdc'],adapter='0x'+'11'*20,minimum_finality=2000,block_number=1)
    def test_five_authentic_historical_messages(self):
        for name in json.loads((FIX/'historical-index.json').read_text()):
            with self.subTest(name=name):self.assertEqual(len(verify(name,self.keys,self.deployments)['authorized_signers']),2)
    def test_valid_route_and_net_delivery(self):self.assertEqual(validate_route(self.message,**self.route_args()),self.message.delivered)
    def test_abi_proof_round_trip(self):self.assertEqual(decode(['bytes','bytes'],inbound_proof(self.raw,self.sig)),(self.raw,self.sig))
    def test_outbound_encoding_preserves_hook(self):
        data=outbound_extra(bytes(32),1234,2000,b'authenticated opaque metadata');self.assertEqual(decode(['bytes32','uint256','uint32','bytes'],data),(bytes(32),1234,2000,b'authenticated opaque metadata'))
    def test_v1_keys_cannot_authorize_v2(self):
        old={'publicKeys':[r for r in self.keys['publicKeys'] if r['cctpVersion']==1]}
        with self.assertRaises(ValueError):verify_attestation(self.raw,self.sig,old,2)
    def test_sandbox_keys_cannot_authorize_mainnet(self):
        with self.assertRaises(ValueError):verify_attestation(self.raw,self.sig,json.loads((FIX/'issuer-sandbox-public-keys.json').read_text()),2)
    def test_wrong_signature_count(self):
        for sig in [b'',self.sig[:65],self.sig+self.sig[:65]]:
            with self.subTest(length=len(sig)),self.assertRaises(ValueError):verify_attestation(self.raw,sig,self.keys,2)
    def test_zero_threshold_not_an_authentication_bypass(self):
        with self.assertRaises(ValueError):verify_attestation(self.raw,b'',self.keys,0)
    def test_duplicate_signer(self):
        with self.assertRaises(ValueError):verify_attestation(self.raw,self.sig[:65]*2,self.keys,2)
    def test_unsorted_signers(self):
        with self.assertRaises(ValueError):verify_attestation(self.raw,self.sig[65:]+self.sig[:65],self.keys,2)
    def test_wrong_signing_domain_prefix(self):
        with self.assertRaises(ValueError):verify_attestation(b'\x19Ethereum Signed Message:\n32'+keccak(self.raw),self.sig,self.keys,2)
    def test_high_s_malleability(self):
        sig=bytearray(self.sig);s=int.from_bytes(sig[32:64],'big');sig[32:64]=(N-s).to_bytes(32,'big');sig[64]=28 if sig[64]==27 else 27
        with self.assertRaises(ValueError):verify_attestation(self.raw,bytes(sig),self.keys,2)
    def test_malformed_v(self):
        sig=bytearray(self.sig);sig[64]=0
        with self.assertRaises(ValueError):verify_attestation(self.raw,bytes(sig),self.keys,2)
    def test_changed_nonce_invalidates_attestation(self):
        raw=bytearray(self.raw);raw[20]^=1
        with self.assertRaises(ValueError):verify_attestation(bytes(raw),self.sig,self.keys,2)
    def test_nonce_replay_survives_message_digest_change(self):
        raw=bytearray(self.raw);raw[344:376]=(100).to_bytes(32,'big');other=parse_message(bytes(raw));self.assertNotEqual(keccak(self.raw),keccak(raw));self.assertEqual(nonce_id(self.message.nonce),nonce_id(other.nonce))
        with self.assertRaises(ValueError):validate_route(other,**dict(self.route_args(),consumed_nonces={self.message.nonce}))
    def test_wrong_destination_domain(self):
        with self.assertRaises(ValueError):validate_route(self.message,**dict(self.route_args(),local_domain=420))
    def test_wrong_source_domain(self):
        with self.assertRaises(ValueError):validate_route(self.message,**dict(self.route_args(),source_domain=0))
    def test_wrong_source_messenger(self):
        with self.assertRaises(ValueError):validate_route(self.message,**dict(self.route_args(),source_messenger='22'*32))
    def test_wrong_burn_token(self):
        with self.assertRaises(ValueError):validate_route(self.message,**dict(self.route_args(),source_token='22'*32))
    def test_wrong_destination_messenger(self):
        with self.assertRaises(ValueError):validate_route(self.message,**dict(self.route_args(),local_messenger='0x'+'22'*20))
    def test_bound_caller_is_adapter_not_router(self):
        args=self.route_args();raw=bytearray(self.raw);raw[108:140]=address_word(args['adapter']);m=parse_message(bytes(raw));self.assertGreater(validate_route(m,**args),0)
        with self.assertRaises(ValueError):validate_route(m,**dict(args,adapter='0x'+'22'*20))
    def test_fast_requires_explicit_peer_policy(self):
        m=parse_message(bytes.fromhex((FIX/'arbitrum-fast.message.hex').read_text()));args=dict(self.route_args(),source_domain=3,source_token=self.deployments['3']['usdc'],source_messenger=self.deployments['3']['token_messenger'])
        with self.assertRaises(ValueError):validate_route(m,**args)
        self.assertEqual(validate_route(m,**dict(args,minimum_finality=1000)),m.amount-m.fee)
    def test_expiry_equality_rejected(self):
        raw=bytearray(self.raw);raw[344:376]=(100).to_bytes(32,'big');m=parse_message(bytes(raw))
        with self.assertRaises(ValueError):validate_route(m,**dict(self.route_args(),block_number=100))
    def test_truncated_messages(self):
        for size in [0,4,12,44,148,228,375]:
            with self.subTest(size=size),self.assertRaises(ValueError):parse_message(self.raw[:size])
    def test_unsupported_wire_version(self):
        raw=bytearray(self.raw);raw[:4]=bytes(4)
        with self.assertRaises(ValueError):parse_message(bytes(raw))
    def test_noncanonical_evm_recipient(self):
        raw=bytearray(self.raw);raw[184]=1
        with self.assertRaises(ValueError):parse_message(bytes(raw))
    def test_fee_above_maximum(self):
        raw=bytearray(self.raw);raw[312:344]=(self.message.max_fee+1).to_bytes(32,'big')
        with self.assertRaises(ValueError):parse_message(bytes(raw))
    def test_boolean_is_not_an_amount_or_threshold(self):
        with self.assertRaises(ValueError):outbound_extra(bytes(32),True,2000)
        with self.assertRaises(ValueError):verify_attestation(self.raw,self.sig,self.keys,True)
    def test_outbound_dirty_evm_recipient_rejected(self):
        with self.assertRaises(ValueError):outbound_destination(b'\x01'+bytes(31),bytes(32),address_model='EVM')
    def test_outbound_dirty_evm_caller_rejected(self):
        with self.assertRaises(ValueError):outbound_destination(address_word('0x'+'11'*20),b'\x01'+bytes(31),address_model='EVM')
    def test_native_non_evm_destination_is_not_truncated(self):
        recipient=bytes.fromhex(self.deployments['5']['usdc']);self.assertEqual(outbound_destination(recipient,bytes(32),address_model='Solana')[0],recipient)
    def test_dirty_evm_source_sender_rejected(self):
        raw=bytearray(self.raw);raw[248]=1;m=parse_message(bytes(raw))
        with self.assertRaises(ValueError):validate_route(m,**self.route_args())
    def test_no_invented_420_domain_or_support(self):
        status=eligibility((FIX/'issuer-supported-domains.md').read_text(),(FIX/'issuer-usdc-addresses.md').read_text());self.assertFalse(status['cctp_listed']);self.assertFalse(status['native_usdc_listed']);self.assertIsNone(status['assigned_domain'])
if __name__=='__main__':unittest.main()
