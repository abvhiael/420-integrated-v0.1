#!/usr/bin/env python3
"""C06.1 static accessible website shell qualification (not a browser audit)."""
from pathlib import Path
from html.parser import HTMLParser
root=Path(__file__).resolve().parents[1]
html=(root/"compliance/web/index.html").read_text()
css=(root/"compliance/web/styles.css").read_text()
class Inspection(HTMLParser):
 def __init__(self):super().__init__();self.tags=[];self.ids=set();self.links=[];self.attrs=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);self.tags.append(tag);self.attrs.append((tag,a))
  if "id" in a:self.ids.add(a["id"])
  if tag=="a":self.links.append(a)
p=Inspection();p.feed(html)
def require(ok,msg):
 if not ok:raise SystemExit("C06.1 FAIL: "+msg)
for tag in ("html","head","body","header","nav","main","section","article","footer","h1","h2","h3"):require(tag in p.tags,"missing "+tag)
require(p.tags.count("h1")==1,"must contain one main heading")
require(any(t=="meta" and a.get("name")=="viewport" for t,a in p.attrs),"viewport")
require(any(t=="html" and a.get("lang")=="en" for t,a in p.attrs),"language")
require(any(t=="a" and a.get("href")=="#main" for t,a in p.attrs),"skip main")
require("main" in p.ids and any(t=="nav" and a.get("aria-label")=="Primary" for t,a in p.attrs),"landmarks")
require(all(a["href"][1:] in p.ids for a in p.links if a.get("href","").startswith("#")),"invalid navigation target")
for phrase in ("Development preview","does not certify eligibility","No legal advice","Not published","authenticated evidence"):
 require(phrase in html,"missing safe public disclosure "+phrase)
for phrase in ("@media(max-width:720px)","prefers-reduced-motion","focus-visible","forced-colors","minmax(0,1fr)","--focus:"):
 require(phrase in css,"missing responsive/a11y style "+phrase)
require("<script" not in html and "http://" not in html,"third-party script/insecure dependency")
print("C06.1 semantic accessibility / responsive source checks: PASS")
