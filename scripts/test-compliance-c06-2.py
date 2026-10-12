#!/usr/bin/env python3
"""Public browser boundary, provenance, navigation and rendering regressions."""
import copy
import importlib.util
import json
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("public_browser", ROOT / "scripts/build-compliance-public.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
C = json.loads((ROOT / "compliance/public/catalogue.json").read_text())
S = json.loads((ROOT / "docs/compliance/C02.1-OFFICIAL-SOURCES.json").read_text())

class Inspect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.ids = []
        self.links = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags.append((tag, a))
        if "id" in a:
            self.ids.append(a["id"])
        if tag in {"a", "link"}:
            self.links.append(a.get("href", ""))

class BrowserTests(unittest.TestCase):
    def reject(self, mutate, registry=False):
        c, s = copy.deepcopy(C), copy.deepcopy(S)
        mutate(s if registry else c)
        with self.assertRaises((ValueError, TypeError, KeyError)):
            m.render(c, s)

    def reviewed(self):
        c, s = copy.deepcopy(C), copy.deepcopy(S)
        s["release_enabled"] = True
        for source in s["sources"]:
            source["legal_review"] = "APPROVED"
            source["production_authority"] = True
        r = c["rules"][0]
        r.update(publication="REVIEWED", effective_from="2026-01-01", effective_until="2027-01-01", last_reviewed="2026-02-01",
                 history=[dict(version="v1", reviewed_at="2026-01-01", change="INITIAL_REVIEW", source="FED-ACT", section="Fixture section 1", review_digest="a"*64),
                          dict(version="v2", reviewed_at="2026-02-01", change="AMENDMENT_REVIEW", source="FED-ACT", section="Fixture section 2", review_digest="b"*64)])
        return c, s

    def test_all_pages_deterministic_and_reachable(self):
        out = m.render(C, S)
        self.assertEqual(out, m.render(C, S))
        self.assertEqual(len(out), 12)
        reached = set()
        for name, html in out.items():
            p = Inspect()
            p.feed(html)
            self.assertEqual(len(p.ids), len(set(p.ids)))
            self.assertEqual(sum(t == "h1" for t, a in p.tags), 1)
            self.assertTrue(any(t == "main" and a.get("id") == "main" for t, a in p.tags))
            self.assertFalse(any(t in {"script", "form", "iframe"} for t, a in p.tags))
            for href in p.links:
                u = urlsplit(href)
                if href.startswith("#"):
                    self.assertIn(href[1:], p.ids)
                elif not u.scheme:
                    target = href.removeprefix("./")
                    self.assertTrue(target in out or target in {"index.html", "styles.css"}, target)
                    if target in out:
                        reached.add(target)
                else:
                    self.assertEqual(u.scheme, "https")
            for phrase in ("does not certify eligibility", "No legal advice", "Development preview"):
                self.assertIn(phrase, html)
        self.assertEqual(reached, set(out))

    def test_no_fabricated_legal_dates_or_review(self):
        for name, html in m.render(C, S).items():
            if name.startswith("rule-"):
                for text in ("Coverage unknown", "Effective from", "Effective until", "Not reviewed", "No independently reviewed changes", "Official sources"):
                    self.assertIn(text, html)
                self.assertNotIn("<time", html)

    def test_scope_filters(self):
        out = m.render(C, S)
        self.assertIn("rule-bc-delivery.html", out["topic-delivery.html"])
        self.assertNotIn("rule-federal-product.html", out["topic-delivery.html"])
        self.assertNotIn("rule-vancouver-business.html", out["jurisdiction-british-columbia.html"])

    def test_unknown_regions_topics(self):
        self.reject(lambda c: c["rules"][0].update(jurisdiction="alberta"))
        self.reject(lambda c: c["rules"][0].update(topic="medical"))

    def test_path_traversal_and_duplicate(self):
        self.reject(lambda c: c["rules"][0].update(id="../private"))
        self.reject(lambda c: c["rules"].append(copy.deepcopy(c["rules"][0])))

    def test_private_fields(self):
        for key in ("address", "birth_date", "decision", "order", "reviewer_identity", "legal_authorization"):
            self.reject(lambda c, key=key: c["rules"][0].update({key: "SECRET"}))

    def test_missing_cross_scope_or_duplicate_source(self):
        self.reject(lambda c: c["rules"][0].update(sources=[]))
        self.reject(lambda c: c["rules"][0].update(sources=["NO-SOURCE"]))
        self.reject(lambda c: c["rules"][0].update(sources=["BC-ACT"]))
        self.reject(lambda c: c["rules"][0].update(sources=["FED-ACT", "FED-ACT"]))

    def test_unsafe_source_links(self):
        for url in ("http://laws-lois.justice.gc.ca/a", "https://evil.example/a", "https://user@laws-lois.justice.gc.ca/a", "https://laws-lois.justice.gc.ca/a?order=secret", "https://laws-lois.justice.gc.ca/a#private", "javascript:alert(1)"):
            self.reject(lambda s, url=url: s["sources"][0].update(url=url), registry=True)

    def test_unpublished_no_fake_review(self):
        self.reject(lambda c: c["rules"][0].update(effective_from="2026-01-01"))
        self.reject(lambda c: c["rules"][0].update(history=[{"version": "fake"}]))
        self.reject(lambda c: c["rules"][0].update(publication="ALLOW"))

    def test_no_approval_from_discovery(self):
        c, s = self.reviewed()
        s["release_enabled"] = False
        with self.assertRaises(ValueError):
            m.render(c, s)
        s["release_enabled"] = True
        s["sources"][0]["legal_review"] = "PENDING"
        with self.assertRaises(ValueError):
            m.render(c, s)

    def test_reviewed_history_dates_and_version_render(self):
        c, s = self.reviewed()
        html = m.render(c, s)["rule-federal-product.html"]
        for phrase in ("v1", "v2", "Reviewed amendment", "Fixture section 2", "2026-02-01", "inclusive", "exclusive", "Recheck canonical"):
            self.assertIn(phrase, html)
        self.assertLess(html.index("<strong>v1"), html.index("<strong>v2"))
        self.assertIn("a"*64, html)

    def test_partial_revoked_superseded_visible(self):
        c, s = self.reviewed()
        for state, phrase in (("PARTIAL", "Unresolved requirements"), ("REVOKED", "Do not rely"), ("SUPERSEDED", "Do not rely")):
            c["rules"][0]["publication"] = state
            self.assertIn(phrase, m.render(c, s)["rule-federal-product.html"])

    def test_review_history_adversaries(self):
        for mutation in (
            lambda r: r.update(effective_until="2025-01-01"),
            lambda r: r.update(effective_from="2026-02-30"),
            lambda r: r["history"][1].update(version="v1"),
            lambda r: r["history"][1].update(reviewed_at="2025-01-01"),
            lambda r: r["history"][1].update(review_digest="missing"),
            lambda r: r["history"][1].update(source="BC-ACT"),
            lambda r: r["history"][1].update(section=""),
            lambda r: r["history"][1].update(reviewer_email="private@example.com"),
        ):
            c, s = self.reviewed()
            mutation(c["rules"][0])
            with self.assertRaises(ValueError):
                m.render(c, s)

    def test_html_escaping(self):
        c, s = self.reviewed()
        c["rules"][0]["history"][1]["section"] = '<script>alert("x")</script>'
        s["sources"][0]["title"] = '<img src=x onerror=alert(1)>'
        html = m.render(c, s)["rule-federal-product.html"]
        self.assertNotIn("<script>", html)
        self.assertNotIn("<img", html)
        self.assertIn("&lt;script&gt;", html)

    def test_bounded_catalogue(self):
        self.reject(lambda c: c.update(rules=[]))
        self.reject(lambda c: c.update(rules=c["rules"]*101))

if __name__ == "__main__":
    unittest.main()
