#!/usr/bin/env python3
from pathlib import Path
import json,re

ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"hz/config/gca-generate-studio-ux-v1.json"
HTML=ROOT/"hz/web/index.html"
JS=ROOT/"hz/web/generate-studio.mjs"
CSS=ROOT/"hz/web/styles.css"
TEST=ROOT/"hz/web/test/generate-studio.test.mjs"
DOC=ROOT/"docs/architecture/420hz/HZ-GCA-6-GENERATE-STUDIO-UX.md"
WEBDOC=ROOT/"docs/420HZ-WEB.md"
ROAD=ROOT/"docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
WORKSPACE=ROOT/"hz/config/gca-project-workspace-v1.json"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [M,HTML,JS,CSS,TEST,DOC,WEBDOC,ROAD,WORKSPACE]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    m=json.loads(M.read_text()); html=HTML.read_text(); js=JS.read_text(); css=CSS.read_text(); tests=TEST.read_text()
    doc=DOC.read_text(); webdoc=WEBDOC.read_text(); road=ROAD.read_text(); workspace=json.loads(WORKSPACE.read_text())

    need(m.get("schema")=="420hz-gca-generate-studio-ux-v1","manifest schema drift")
    need(m.get("version")==1,"manifest version drift")
    need(m.get("canonicalStep")=="HZ-GCA-6","canonical step drift")
    need(m.get("qualificationLevel")==1,"HZ-GCA-6 must remain Level 1")
    need(m.get("milestoneRequired") is False,"HZ-GCA-6 must not silently become Level 2")
    need(workspace.get("canonicalStep")=="HZ-GCA-5","HZ-GCA-5 prerequisite drift")

    nav=m.get("navigation",{})
    need(nav.get("homeCta")=="Generate your own song","home CTA drift")
    need(nav.get("sectionId")=="generate","Generate section ID drift")
    need(nav.get("navEntry") is True,"Generate nav entry missing")
    need(nav.get("fullyNavigableDevFlow") is True,"dev-flow navigation flag missing")

    expected_screens=[
      "generate landing","prompt/lyrics composer","advanced music controls","cost/capacity preview",
      "generation progress","A/B take comparison","audio player and stem preview where available",
      "provenance/disclosure panel","save/regenerate/remix controls","Register & Publish handoff","failure/retry/refund state"
    ]
    need(m.get("screens")==expected_screens,"required screen inventory drift")

    dev=m.get("devExecution",{})
    need(dev.get("model")=="GenerateStudioModel420","studio model drift")
    need(dev.get("provider")=="mock:420hz","mock provider drift")
    need(dev.get("modelId")=="mock:music","mock model drift")
    need(dev.get("modelVersion")=="1.0.0","mock model version drift")
    need(dev.get("liveClaim") is False,"studio must not claim live execution")
    need(dev.get("quoteAuthoritative") is False,"quote must remain non-authoritative")
    need(dev.get("registerPublishTransaction") is False,"HZ-GCA-6 cannot submit Register & Publish")
    need(dev.get("publicationAuthority") is False and dev.get("settlementAuthority") is False,"authority boundary drift")

    acc=m.get("accessibility",{})
    for key in ["semanticHeadings","labelBoundInputs","liveStatusRegions","progressElement","ariaPressedForTakeSelection","audioControlsLabeled","keyboardNativeControls","reducedMotionSupport"]:
        need(acc.get(key) is True,f"accessibility requirement missing: {key}")

    resp=m.get("responsive",{})
    need(resp.get("desktop") is True,"desktop support missing")
    need(resp.get("tabletBreakpointPx")==760,"tablet breakpoint drift")
    need(resp.get("mobileBreakpointPx")==480,"mobile breakpoint drift")
    need(resp.get("oneColumnMobileForms") is True,"mobile form collapse missing")
    need(resp.get("oneColumnMobileTakeComparison") is True,"mobile take collapse missing")

    sm=m.get("stateModel",{})
    need(sm.get("states")==["LANDING","COMPOSING","READY","GENERATING","COMPARE","SAVED","FAILED","CANCELLED"],"studio state drift")
    need(sm.get("generateRequiresValidPromptAndCapacity") is True,"generate readiness guard missing")
    need(sm.get("completeTakes")==["A","B"],"A/B take contract drift")
    need(sm.get("saveRequiresSelectedTake") is True,"save guard missing")
    need(sm.get("publishHandoffRequiresSavedTake") is True,"publish handoff guard missing")
    need(sm.get("cancellationNoOutputSuccess") is True,"cancel boundary missing")
    need(sm.get("refundStateNoFabrication")=="NO_SETTLEMENT_OBSERVED","refund boundary drift")

    bounds=" ".join(m.get("authorityBoundaries",[]))
    for token in ["not canonical protocol authority","non-authoritative","does not imply Creative registration or publication","HZ-GCA-7","never fabricate settlement or refund completion","no production chain ID","not public-indexed","do not fabricate playable public media"]:
        need(token in bounds,f"authority boundary missing: {token}")

    inv=m.get("invariants",[])
    need(len(inv)==18,"expected HZGCA6-001..018")
    for i,x in enumerate(inv,1): need(x.startswith(f"HZGCA6-{i:03d} "),f"invariant numbering drift at {i}")

    # Required UI and accessibility tokens.
    for token in [
      'href="#generate">Generate your own song</a>',
      'id="generateStudio"',
      'id="studioLanding"',
      'id="songPrompt"',
      'id="songLyrics"',
      'advanced music controls',
      'id="quotePrice"',
      'id="quoteCapacity"',
      'id="generationProgress"',
      'id="takeCards"',
      'id="studioProvenance"',
      'id="saveTakeButton"',
      'id="regenerateButton"',
      'id="remixTakeButton"',
      'id="registerPublishButton"',
      'Register & Publish',
      'id="studioFailure"',
      'id="retryGenerationButton"',
      'aria-live="polite"',
      'aria-labelledby="generateHeading"',
      'type="module" src="/generate-studio.mjs"'
    ]:
        need(token in html,f"Generate Studio HTML missing: {token}")

    for token in [
      "export class GenerateStudioModel420",
      "export function mountGenerateStudio420",
      '"LANDING","COMPOSING","READY","GENERATING","COMPARE","SAVED","FAILED","CANCELLED"',
      'authoritative:false',
      'this.takes=[make("A",1),make("B",2)]',
      'state="FAILED"',
      'refundState="NO_SETTLEMENT_OBSERVED"',
      'action:"REGISTER_AND_PUBLISH_HANDOFF"',
      'enabled:false',
      "HZ-GCA-7 owns registration/publication",
      '<audio controls preload="none"',
      'aria-pressed',
      'model.selectTake',
      'model.saveSelected',
      'model.regenerate',
      'model.remix',
      'model.retry',
      'model.cancel'
    ]:
        need(token in js,f"Generate Studio runtime missing: {token}")

    for token in [
      ".studio-shell",".form-grid",".take-grid",".provenance-grid","@media(max-width:760px)","@media(max-width:480px)",
      "@media(prefers-reduced-motion:reduce)",".select-take[aria-pressed=\"true\"]"
    ]:
        need(token in css,f"Generate Studio responsive/accessibility CSS missing: {token}")

    for token in [
      "studio starts fail-closed",
      "non-authoritative development capacity projection",
      "two comparable complete development takes",
      "instrumental mode removes lyric-dependent",
      "A/B selection, save, regenerate and remix",
      "Register & Publish is only an explicit handoff",
      "provider failure exposes retryable failure",
      "cancelled generation never fabricates refund",
      "no capacity prevents generation readiness",
      "never represents registration, publication or settlement as complete"
    ]:
        need(token in tests,f"required HZ-GCA-6 test missing: {token}")

    need("Generate your own song" in webdoc,"420Hz web doc missing Generate CTA")
    need("HZ-GCA-7" in webdoc,"420Hz web doc missing Register & Publish ownership")
    need("## HZ-GCA-6 — 420Hz Generate Studio UX" in road,"canonical HZ-GCA-6 roadmap step missing")
    for token in ["Generate landing page","prompt/lyrics composer","advanced music controls","cost/capacity preview","generation progress","A/B take comparison","audio player and stem preview","provenance/disclosure panel","save/regenerate/remix controls","Register & Publish","failures/retry/refund state","responsive/mobile behavior and accessibility"]:
        need(token in road,f"canonical roadmap requirement missing: {token}")
    need("Level 1 ordinary app-scoped UX step" in road,"HZ-GCA-6 Level-1 classification missing")
    need("fully navigable Generate workflow against qualified mock/dev execution" in road,"canonical exit missing")

    blob=json.dumps(m)+"\n"+html+"\n"+js
    need(re.search(r"0x[a-fA-F0-9]{40}",blob) is None,"HZ-GCA-6 must not invent deployed addresses")
    need("indexerBaseUrl" not in js,"Generate Studio must not invent/use a live Indexer URL")
    need("fetch(" not in js,"pre-testnet Generate Studio must not invent network calls")
    need(m.get("nextCanonicalStep")=="HZ-GCA-7 — Register & Publish integration","next canonical step drift")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-6 Generate Studio UX",
  "qualificationLevel":1,
  "invariants":0 if errors else len(m.get("invariants",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
