import hashlib
import subprocess
import tempfile
import unittest
from pathlib import Path
from pay_regression_inventory import Inventory, CORE, BOUNDARY, SUPPORT, SHARED_INTERFACE, imports, tokens, write_inventory


class DiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.git('init', '-q')
        self.git('config', 'user.name', 'Inventory test')
        self.git('config', 'user.email', 'inventory@example.invalid')
        for p in CORE | BOUNDARY | SUPPORT | SHARED_INTERFACE:
            self.put(p, '// fixture\n')
        self.put('contracts/src/pay/PaymentRouter420.sol', 'contract PaymentRouter420 {}')
        self.put('contracts/test/Helper.sol', 'import {PaymentRouter420 as Router} from "../src/pay/PaymentRouter420.sol";')
        self.put('contracts/test/nested/NoPayInName.t.sol', 'import /* comment */ "../Helper.sol"; contract TestOwner { function testOne() public {} }')
        self.put('contracts/test/BetVideoPokerPaytable54.t.sol', 'contract TestOwner { function testPlay() public {} }')
        self.put('contracts/test/ComputeJobPayerCustody420.t.sol', 'contract TestOwner { function testCustody() public {} }')
        self.put('contracts/test/Supporting.t.sol', 'contract Shared { function testBoundary() public {} }')
        self.put('contracts/test/Integration.t.sol', 'import "./Helper.sol"; import "./Supporting.t.sol";')
        self.put('contracts/test/Sponsor.t.sol', 'import "../src/accounts/SponsorshipPolicy420.sol";')
        self.put('contracts/test/ReplayInterface.t.sol', 'import "../src/interfaces/genesis/IReplayProtection420.sol";')
        self.put('contracts/test/Swap.t.sol', 'import "../src/swap/CanonicalSwapExecutor420.sol";')
        self.put('contracts/test/Dynamic.t.sol', 'contract X { function testX() public { bytes32 id = keccak256("420/service/pay/v1"); } }')
        self.put('contracts/test/fixtures/cadc/upstream/@openzeppelin/contracts/X.sol', 'import "@layerzerolabs/Y.sol";')
        self.put('contracts/test/fixtures/cadc/upstream/@layerzerolabs/Y.sol', '// leaf')
        self.put('contracts/test/Cadc.t.sol', 'import "@openzeppelin/contracts/X.sol";')
        self.put('contracts/test-governance-audit-6/Other.t.sol', 'contract Other {}')
        self.put('contracts/test/DeclaredOwner.sol', 'import "./Helper.sol"; contract Other {function testCheck() public {}}')
        self.commit()

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root)

    def put(self, path, content):
        dst = self.root / path; dst.parent.mkdir(parents=True, exist_ok=True); dst.write_text(content)

    def commit(self):
        self.git('add', '.'); self.git('commit', '-qm', 'test fixture')

    def test_all_import_forms_and_comments(self):
        text = '''// import "no1.sol";
        /* import "no2.sol"; */
        string x = "import 'no3.sol';";
        import "a.sol"; import 'b.sol' as B;
        import * as C from "c.sol";
        import {X as Y, Z} /* comment */ from 'd.sol';'''
        self.assertEqual(imports(tokens(text)), ['a.sol', 'b.sol', 'c.sol', 'd.sol'])

    def test_tracked_nested_and_nonstandard_selection(self):
        self.put('contracts/test/UntrackedPay.t.sol', 'import "./Helper.sol";')
        r = Inventory(self.root).discover(); o = r['owners']
        self.assertEqual(r['tracked_test_owners'], 12)
        self.assertEqual(o['contracts/test/nested/NoPayInName.t.sol']['classification'], 'pay')
        self.assertIn('contracts/src/pay/PaymentRouter420.sol', o['contracts/test/nested/NoPayInName.t.sol']['closure'])
        self.assertEqual(o['contracts/test/BetVideoPokerPaytable54.t.sol']['classification'], 'unrelated')
        self.assertEqual(o['contracts/test/ComputeJobPayerCustody420.t.sol']['classification'], 'unrelated')
        self.assertEqual(o['contracts/test/Supporting.t.sol']['classification'], 'supporting')
        self.assertEqual(o['contracts/test/Sponsor.t.sol']['classification'], 'shared-boundary')
        self.assertEqual(o['contracts/test/Swap.t.sol']['classification'], 'supporting')
        self.assertEqual(o['contracts/test/ReplayInterface.t.sol']['classification'], 'shared-interface-only')
        self.assertEqual(o['contracts/test/Dynamic.t.sol']['classification'], 'pay')
        self.assertIn('contracts/test/DeclaredOwner.sol', r['selected'])
        self.assertIn('contracts/test/fixtures/cadc/upstream/@layerzerolabs/Y.sol', o['contracts/test/Cadc.t.sol']['closure'])
        self.assertNotIn('contracts/test/UntrackedPay.t.sol', o)

    def test_cycle(self):
        self.put('contracts/test/Helper.sol', 'import "./Integration.t.sol"; import "../src/pay/PaymentRouter420.sol";'); self.commit()
        self.assertIn('contracts/test/Integration.t.sol', Inventory(self.root).discover()['selected'])

    def test_unresolved_import_fails_closed_with_report(self):
        self.put('contracts/test/Bad.t.sol', 'import "./absent.sol";'); self.commit()
        out = self.root / 'out'
        with self.assertRaisesRegex(RuntimeError, 'unresolved imports'):
            write_inventory(Inventory(self.root), out)
        self.assertTrue((out / 'inventory.json').exists())

    def test_checkout_identity_drift(self):
        self.put('contracts/src/pay/PaymentRouter420.sol', 'contract Changed {}')
        with self.assertRaisesRegex(ValueError, 'differ from exact HEAD'):
            Inventory(self.root).read('contracts/src/pay/PaymentRouter420.sol')

    def test_baseline_all_hashes_and_missing(self):
        inv = Inventory(self.root); r = inv.discover(); owner = 'contracts/test/Integration.t.sol'
        closure = r['owners'][owner]['closure']; hashes = {p.removeprefix('contracts/'): hashlib.sha256(inv.read(p)).hexdigest() for p in closure}
        b = {'pass': True, 'profile': 'ci', 'head': inv.head, 'tests': [owner.removeprefix('contracts/')], 'source_sha256': hashes}
        c = inv.compare_baseline(r, b)
        self.assertEqual(c['expected_hashes'], len(hashes)); self.assertEqual(c['mismatched'], [])
        self.assertEqual(c['reusable'], [owner]); self.assertIn('contracts/test/Sponsor.t.sol', c['missing'])
        b['source_sha256']['src/pay/PaymentRouter420.sol'] = '0'*64
        c = inv.compare_baseline(r,b)
        self.assertEqual(c['mismatched'], ['src/pay/PaymentRouter420.sol']); self.assertIn(owner,c['missing'])

if __name__ == '__main__':
    unittest.main()
