import importlib.util
from pathlib import Path
import unittest
from cryptography.exceptions import InvalidTag
p=Path(__file__).resolve().parents[1]/"crypto.py"
spec=importlib.util.spec_from_file_location("doobr_crypto",p)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
KEY=bytes(range(32))
class TestEnvelope(unittest.TestCase):
    def test_round_trip_and_randomization(self):
        args=dict(key=KEY,tenant_id="tenant-a",order_id="order-a",purpose="address",plaintext=b"private street")
        a=mod.encrypt_field(**args);b=mod.encrypt_field(**args)
        self.assertNotEqual(a,b)
        self.assertEqual(mod.decrypt_field(key=KEY,tenant_id="tenant-a",order_id="order-a",purpose="address",payload=a),b"private street")
    def test_tampering_and_scope(self):
        v=mod.encrypt_field(key=KEY,tenant_id="t",order_id="o",purpose="custody",plaintext=b"seal")
        for overrides in [{"tenant_id":"other"},{"order_id":"other"},{"purpose":"address"},{"key":bytes(reversed(KEY))}]:
            a=dict(key=KEY,tenant_id="t",order_id="o",purpose="custody",payload=v);a.update(overrides)
            with self.assertRaises(InvalidTag):mod.decrypt_field(**a)
        c=bytearray(v);c[-1]^=1
        with self.assertRaises(InvalidTag):mod.decrypt_field(key=KEY,tenant_id="t",order_id="o",purpose="custody",payload=bytes(c))
    def test_invalid_inputs(self):
        with self.assertRaises(ValueError):mod.encrypt_field(key=b"weak",tenant_id="t",order_id="o",purpose="address",plaintext=b"x")
        with self.assertRaises(ValueError):mod.decrypt_field(key=KEY,tenant_id="t",order_id="o",purpose="address",payload=b"invalid")
if __name__=="__main__":unittest.main()
