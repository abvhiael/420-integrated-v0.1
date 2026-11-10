#!/usr/bin/env python3
import importlib.util
import itertools
import pathlib
import unittest

path = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "qualify-420bet-game-platform.py"
spec = importlib.util.spec_from_file_location("bet_qualification", path)
mod = importlib.util.module_from_spec(spec)
import sys
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)

class QualificationTests(unittest.TestCase):
    def test_positive_multi_wager_conservation(self):
        book = mod.Ledger(1000)
        book.accept("a", 100, 700)
        book.accept("b", 100, 500)
        self.assertEqual(book.book.reserved, 1000)
        book.close("a", "settle", 700)
        book.close("b", "refund")
        self.assertEqual(book.book.bankroll, 400)
        self.assertEqual(book.book.reserved, 0)
        self.assertEqual(book.book.stakes_held, 0)
        self.assertEqual(book.book.refunded, 100)
    def test_all_terminal_combinations(self):
        for first, second in itertools.product(("settle", "refund"), repeat=2):
            b = mod.Ledger(100)
            b.accept("a", 10, 60)
            b.accept("b", 10, 60)
            b.close("a", first, 60 if first == "settle" else 0)
            b.close("b", second, 60 if second == "settle" else 0)
            b.check()
    def test_reject_overcommit_duplicate_and_double_close(self):
        b = mod.Ledger(50)
        b.accept("a", 10, 60)
        for fn in (lambda: b.accept("a", 10, 60),
                   lambda: b.accept("b", 10, 11),
                   lambda: b.close("a", "settle", 61)):
            with self.assertRaises(mod.QualificationError): fn()
        b.close("a", "refund")
        with self.assertRaises(mod.QualificationError): b.close("a", "settle")
    def test_refund_and_negative_integer_fail_closed(self):
        b = mod.Ledger(50)
        for args in (("a", -1, 10), ("b", True, 10), ("c", 10, 9)):
            with self.assertRaises(mod.QualificationError): b.accept(*args)
        b.accept("d", 10, 30)
        with self.assertRaises(mod.QualificationError): b.close("d", "refund", 1)
    def test_extra_event_fields_rejected(self):
        with self.assertRaises(mod.QualificationError):
            mod.replay({"bankroll":100, "events":[{"type":"accept", "id":"x",
              "stake":10, "maxGross":20, "override":True}]})
    def test_release_inventory_missing_gates_rejected(self):
        with self.assertRaises(mod.QualificationError):
            mod.check_release_manifest({"schema":"420bet-qualification-v1","verticals":{}})
    def test_false_approval_denied(self):
        rows = {v:{"implementation":"open", "externalGates":{
            g:{"status":"open", "evidence":None} for g in mod.EXTERNAL_GATES}}
            for v in mod.VERTICALS}
        inventory = {"schema":"420bet-qualification-v1","verticals":rows}
        self.assertTrue(mod.check_release_manifest(inventory))
        rows["dice"]["externalGates"]["independentMath"] = {"status":"pass","evidence":None}
        with self.assertRaises(mod.QualificationError):
            mod.check_release_manifest(inventory)

if __name__ == "__main__":
    unittest.main()
