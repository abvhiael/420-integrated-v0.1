#!/usr/bin/env python3
"""Build C06.2 public-only static projections. Never evaluates eligibility."""
import argparse
import json
import re
from datetime import date
from html import escape
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
REGIONS = {"federal": "Canada / Federal", "british-columbia": "British Columbia", "vancouver": "City of Vancouver"}
TOPICS = {"product": "Product rules", "delivery": "Delivery", "business": "Business permissions", "travel": "Travel guidance"}
BOUNDARIES = {
    "federal": "Federal instruments only. Provincial, municipal, Indigenous, licence and venue requirements are separate and unresolved.",
    "british-columbia": "BC instruments only. Municipal, Indigenous, individual licence, carrier and venue requirements are separate and unresolved.",
    "vancouver": "Vancouver instruments only. No precise boundary or address determination; federal, BC, Indigenous, licence and venue authority remains separate.",
}
CHANGES = {"INITIAL_REVIEW": "Initial independent review", "AMENDMENT_REVIEW": "Reviewed amendment", "CORRECTION_REVIEW": "Reviewed correction", "SUPERSESSION_REVIEW": "Reviewed supersession"}
RULE_KEYS = {"id", "jurisdiction", "topic", "sources", "publication", "effective_from", "effective_until", "last_reviewed", "history"}

def need(condition, message):
    if not condition:
        raise ValueError(message)

def day(value):
    need(isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value), "invalid ISO date")
    return date.fromisoformat(value)

def validate(catalogue, registry):
    need(set(catalogue) == {"schema", "rules"} and catalogue["schema"] == "420compliance-public-browser/v1", "invalid catalogue schema")
    need(isinstance(catalogue["rules"], list) and 0 < len(catalogue["rules"]) <= 100, "bounded nonempty rules required")
    sources = {s["id"]: s for s in registry["sources"]}
    seen = set()
    for r in catalogue["rules"]:
        need(set(r) == RULE_KEYS, "unknown or private rule field")
        need(isinstance(r["id"], str) and re.fullmatch(r"[a-z][a-z0-9-]{0,63}", r["id"]), "unsafe rule ID")
        need(r["id"] not in seen, "duplicate rule ID")
        seen.add(r["id"])
        need(r["jurisdiction"] in REGIONS and r["topic"] in TOPICS, "unsupported jurisdiction/topic")
        need(r["publication"] in {"NOT_PUBLISHED", "REVIEWED", "PARTIAL", "REVOKED", "SUPERSEDED"}, "invalid publication status")
        if r["publication"] == "NOT_PUBLISHED":
            need(r["effective_from"] is None and r["effective_until"] is None and r["last_reviewed"] is None, "unpublished rule cannot invent dates")
            need(r["history"] == [], "unpublished rule cannot fabricate reviewed change history")
        else:
            need(registry.get("release_enabled") is True, "independent publication acceptance required")
            need(day(r["effective_from"]) < day(r["effective_until"]), "invalid effective interval")
            reviewed = day(r["last_reviewed"])
            need(isinstance(r["history"], list) and 0 < len(r["history"]) <= 100, "reviewed history required")
            previous = None
            versions = set()
            for h in r["history"]:
                need(set(h) == {"version", "reviewed_at", "change", "source", "section", "review_digest"}, "unknown or private history field")
                when = day(h["reviewed_at"])
                need(when <= reviewed and (previous is None or previous <= when), "unordered history")
                previous = when
                need(isinstance(h["version"], str) and re.fullmatch(r"[a-zA-Z0-9.-]{1,64}", h["version"]) and h["version"] not in versions, "duplicate/invalid version")
                versions.add(h["version"])
                need(h["change"] in CHANGES and h["source"] in r["sources"], "invalid reviewed change citation")
                need(isinstance(h["section"], str) and 0 < len(h["section"]) <= 160, "source section required")
                need(isinstance(h["review_digest"], str) and re.fullmatch(r"[a-f0-9]{64}", h["review_digest"]), "public review commitment required")
            need(previous == reviewed, "last review mismatch")
        need(isinstance(r["sources"], list) and 0 < len(r["sources"]) <= 10, "source references required")
        refs = set()
        for ref in r["sources"]:
            need(isinstance(ref, str) and ref in sources and ref not in refs, "missing/duplicate source")
            refs.add(ref)
            source = sources[ref]
            need(source["jurisdiction"] == r["jurisdiction"], "cross-jurisdiction source")
            if r["publication"] != "NOT_PUBLISHED":
                need(source.get("legal_review") == "APPROVED" and source.get("production_authority") is True, "discovery source is not approved")
            u = urlsplit(source["url"])
            need(u.scheme == "https" and u.netloc == source["approved_host"] and not u.username and not u.password and not u.query and not u.fragment, "unsafe official source URL")
            need(source["approved_host"] in {"laws-lois.justice.gc.ca", "www.bclaws.gov.bc.ca", "www2.gov.bc.ca", "vancouver.ca", "bylaws.vancouver.ca"}, "unapproved source host")
    return sources

def page(title, body):
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex"><title>{escape(title)} | 420Compliance</title>
<link rel="stylesheet" href="./styles.css"></head><body>
<a class="skip-link" href="#main">Skip to main content</a><header class="site-header"><div class="header-inner">
<a class="brand" href="./index.html">420Compliance</a><nav aria-label="Primary"><a href="./index.html">Overview</a><a href="./browser.html">Jurisdictions &amp; topics</a></nav></div></header>
<main id="main" tabindex="-1" class="section"><p class="eyebrow">Public source discovery</p><h1>{escape(title)}</h1>
<div class="callout" role="note"><strong>Development preview</strong><p>This page does not certify eligibility or permission to operate. No legal advice or authorization. Source discovery is not independent legal review.</p></div>
{body}</main><footer class="footer"><p>420Compliance / 420 Integrated · Informational development preview</p></footer></body></html>
'''

def status(r):
    return {"NOT_PUBLISHED": "Not published · Coverage unknown", "REVIEWED": "Reviewed publication snapshot · Recheck current status", "PARTIAL": "Partial coverage · Unresolved requirements", "REVOKED": "Revoked · Do not rely on this version", "SUPERSEDED": "Superseded · Do not rely on this version"}[r["publication"]]

def cards(rules):
    return '<ul class="card-grid rule-list">' + ''.join(f'<li class="card"><h3><a href="./rule-{r["id"]}.html">{escape(REGIONS[r["jurisdiction"]])} — {escape(TOPICS[r["topic"]])}</a></h3><p class="status">{escape(status(r))}</p></li>' for r in rules) + '</ul>'

def render(catalogue, registry):
    sources = validate(catalogue, registry)
    rules = catalogue["rules"]
    region_links = ''.join(f'<li><a href="./jurisdiction-{k}.html">{escape(v)}</a></li>' for k, v in REGIONS.items())
    topic_links = ''.join(f'<li><a href="./topic-{k}.html">{escape(v)}</a></li>' for k, v in TOPICS.items())
    out = {"browser.html": page("Browse jurisdictions and topics", f'<h2>By jurisdiction</h2><ul>{region_links}</ul><h2>By topic</h2><ul>{topic_links}</ul><h2>Source-linked rule pages</h2>{cards(rules)}<h2>Coverage boundaries</h2><p>All coverage is unknown pending independent review. Other provinces, municipalities, Indigenous authorities, medical cannabis, cultivation, accommodation, events and marketplace sales are not covered. No address, service zone or courier availability is inferred.</p>')}
    for region, label in REGIONS.items():
        selected = [r for r in rules if r["jurisdiction"] == region]
        out[f"jurisdiction-{region}.html"] = page(label, f'<p>{escape(BOUNDARIES[region])}</p><h2>Topics in this jurisdiction</h2>{cards(selected)}')
    for topic, label in TOPICS.items():
        selected = [r for r in rules if r["topic"] == topic]
        out[f"topic-{topic}.html"] = page(label, '<h2>Jurisdictions for this topic</h2>' + (cards(selected) if selected else '<p>No published or discovery entries for this topic. Coverage unknown.</p>'))
    for r in rules:
        citations = ''.join(f'<li><a href="{escape(sources[s]["url"], quote=True)}" rel="noreferrer">{escape(sources[s]["title"])}</a> <span>({escape(sources[s]["type"])})</span><p>Section-level rule interpretation: not reviewed.</p></li>' for s in r["sources"])
        title = REGIONS[r["jurisdiction"]] + " — " + TOPICS[r["topic"]]
        body = f'''<p><a href="./jurisdiction-{r['jurisdiction']}.html">Browse this jurisdiction</a> · <a href="./topic-{r['topic']}.html">Browse this topic</a></p>
<h2>Rule publication status</h2><p>Not published. No reviewed rule text is available; linked official instruments are discovery references only.</p>
<h2>Coverage boundaries</h2><p>{escape(BOUNDARIES[r['jurisdiction']])}</p><p>Coverage unknown. No legal eligibility, licence approval, checkout or provider supply is represented.</p>
<h2>Effective dates and review</h2><dl><dt>Legal commencement</dt><dd>Unknown — independent source review required</dd><dt>Effective from</dt><dd>Unknown — not published</dd><dt>Effective until</dt><dd>Unknown — not published</dd><dt>Last independent review</dt><dd>Not reviewed</dd><dt>Policy version</dt><dd>No published version</dd></dl>
<h2>Official sources</h2><ul>{citations}</ul><p>Source type does not determine precedence. Guidance, licence conditions and operative legislation must be reviewed separately.</p>
<h2>Reviewed change history</h2><p>No independently reviewed changes have been published. Software development dates and source retrieval dates are not legal effective or review dates.</p>'''
        if r["publication"] != "NOT_PUBLISHED":
            history = ''.join(f'<li><strong>{escape(h["version"])}</strong> — <time datetime="{h["reviewed_at"]}">{h["reviewed_at"]}</time>: {CHANGES[h["change"]]}. <a href="{escape(sources[h["source"]]["url"], quote=True)}">{escape(sources[h["source"]]["title"])}</a>, {escape(h["section"])}. Public review commitment: <code>{h["review_digest"]}</code></li>' for h in r["history"])
            dates = f'<h2>Effective dates and review</h2><dl><dt>Effective from (inclusive)</dt><dd><time>{r["effective_from"]}</time></dd><dt>Effective until (exclusive)</dt><dd><time>{r["effective_until"]}</time></dd><dt>Last independent review</dt><dd><time>{r["last_reviewed"]}</time></dd><dt>Policy version</dt><dd>{escape(r["history"][-1]["version"])}</dd></dl>'
            body = f'<p><a href="./jurisdiction-{r["jurisdiction"]}.html">Browse this jurisdiction</a> · <a href="./topic-{r["topic"]}.html">Browse this topic</a></p><h2>Rule publication status</h2><p class="status">{escape(status(r))}</p><h2>Coverage boundaries</h2><p>{escape(BOUNDARIES[r["jurisdiction"]])}</p><p>Informational snapshot only. Dates do not prove current source freshness, complete legal coverage or operational eligibility. Recheck canonical publication before reliance.</p>{dates}<h2>Official sources</h2><ul>{citations}</ul><h2>Reviewed change history</h2><ol>{history}</ol>'
        out[f"rule-{r['id']}.html"] = page(title, body)
    return out

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--check", action="store_true")
    args = p.parse_args()
    root = ROOT / "compliance/web"
    catalogue = json.loads((ROOT / "compliance/public/catalogue.json").read_text())
    registry = json.loads((ROOT / "docs/compliance/C02.1-OFFICIAL-SOURCES.json").read_text())
    output = render(catalogue, registry)
    existing = {f.name for pattern in ("browser.html", "jurisdiction-*.html", "topic-*.html", "rule-*.html") for f in root.glob(pattern)}
    need(existing <= set(output), "stale public pages must be removed explicitly")
    for name, content in output.items():
        if args.check:
            need((root / name).is_file() and (root / name).read_text() == content, "generated page drift: " + name)
        else:
            (root / name).write_text(content)
    print(f"C06.2 public browser: {len(output)} deterministic pages PASS")

if __name__ == "__main__":
    main()
