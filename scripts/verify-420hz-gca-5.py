#!/usr/bin/env python3
from pathlib import Path
import json,re

ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"hz/config/gca-project-workspace-v1.json"
SRC=ROOT/"hz/generate/src/project-workspace.js"
TEST=ROOT/"hz/generate/test/project-workspace.test.js"
DOC=ROOT/"docs/architecture/420hz/HZ-GCA-5-PROJECT-WORKSPACE-STORAGE.md"
ROAD=ROOT/"docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
STORE=ROOT/"hz/config/gca-storage-retention-v1.json"
PROV=ROOT/"hz/config/gca-provenance-consent-rights-v1.json"
PKG=ROOT/"hz/generate/package.json"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [M,SRC,TEST,DOC,ROAD,STORE,PROV,PKG]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    m=json.loads(M.read_text()); src=SRC.read_text(); tests=TEST.read_text(); doc=DOC.read_text()
    road=ROAD.read_text(); store=json.loads(STORE.read_text()); prov=json.loads(PROV.read_text()); pkg=json.loads(PKG.read_text())

    need(m.get("schema")=="420hz-gca-project-workspace-v1","manifest schema drift")
    need(m.get("version")==1,"manifest version drift")
    need(m.get("canonicalStep")=="HZ-GCA-5","canonical step drift")
    need(m.get("qualificationLevel")==1,"HZ-GCA-5 must remain Level 1")
    need(m.get("milestoneRequired") is False,"HZ-GCA-5 must not silently become Level 2")
    need(m.get("baseMainSha")=="6a3c611a3c0629c9bbae1e67f992d98ba1787550","base main SHA drift")

    dep=m.get("dependencies",{})
    need(dep.get("priorStep")=="HZ-GCA-4","prior step drift")
    need(dep.get("storageRetentionPolicy")=="hz/config/gca-storage-retention-v1.json","storage-retention dependency drift")
    need(dep.get("provenancePolicy")=="hz/config/gca-provenance-consent-rights-v1.json","provenance dependency drift")
    need("420ResourceProtocol/420Store" in dep.get("canonicalExternalStorageAuthority",""),"external storage authority boundary missing")

    p=m.get("project",{})
    need(p.get("visibility")=="PRIVATE","project visibility must remain PRIVATE")
    need(p.get("indexable") is False,"private projects must remain non-indexable")
    need(p.get("statuses")==["ACTIVE","ARCHIVED","DELETED"],"project status drift")
    need(p.get("ownerMutationRequired") is True,"owner mutation guard missing")
    vt=p.get("versionTree",{})
    need(vt.get("immutableNodes") is True and vt.get("parentLinked") is True and vt.get("headPointer") is True,"version tree guarantees missing")
    need(p.get("drafts")==["lyricsDraft","metadataDraft","title"],"draft field set drift")

    takes=m.get("takes",{})
    need(takes.get("statuses")==["COMPLETE","INCOMPLETE","FAILED","CANCELLED"],"take status drift")
    need(takes.get("favoriteCompleteOnly") is True,"favorite COMPLETE gate missing")
    need(takes.get("selectableCompleteMixOnly") is True,"selection MIX gate missing")
    need(takes.get("incompleteOrFailedSelectable") is False,"incomplete/failed selection must remain false")
    need(takes.get("artifactKinds")==["MIX","STEM","LYRICS_TIMING","ARTWORK"],"artifact kind drift")

    st=m.get("storage",{})
    need(st.get("applicationStore")=="DeterministicPrivateStorage420","private storage adapter drift")
    need(st.get("class")=="HZ_PRIVATE_PRIMARY","private storage class drift")
    need(st.get("integrity")=="sha256","integrity algorithm drift")
    need(st.get("antiResurrectionTombstone") is True,"anti-resurrection tombstone missing")
    need(st.get("publicIndexing") is False,"private storage must never become public-indexed")
    need(st.get("externalStorageAuthorityNotClaimed") is True,"external storage authority overclaim")

    ret=m.get("retention",{})
    need(ret.get("failedCancelledDays")==7,"failed/cancelled retention drift")
    need(ret.get("unsavedTakeDays")==30,"unsaved take retention drift")
    need(ret.get("activeProjectInactivityDays")==365,"active project inactivity drift")
    need(ret.get("archiveGraceDays")==30,"archive grace drift")
    need(ret.get("exportHours")==24,"export retention drift")

    q=m.get("quota",{})
    need(q.get("configurableNotProtocolConstant") is True,"quota must remain configuration")
    need(q.get("preflightBeforeWrite") is True,"quota preflight missing")
    need(q.get("failClosed") is True,"quota must fail closed")
    need(q.get("neverSilentlyDeletesSavedOrPublishedWork") is True,"quota destructive behavior guard missing")

    ex=m.get("export",{})
    need(ex.get("authenticated") is True,"export authentication requirement missing")
    need(ex.get("expiresHours")==24,"export expiry drift")
    need(ex.get("secretsIncluded") is False,"export secret exclusion drift")
    need(ex.get("publicVisibilityCreated") is False,"export must not create public visibility")

    dele=m.get("deletion",{})
    for key in ["servingRevokedImmediately","indexingRevokedImmediately","tombstoneRequired","privateStorageRefsDeleted","exportRefsDeleted"]:
        need(dele.get(key) is True,f"deletion rule missing: {key}")
    need(dele.get("immutableCanonicalHistoryNotClaimedDeleted") is True,"canonical-history deletion overclaim")

    boundaries=" ".join(m.get("authorityBoundaries",[]))
    for token in ["application-controlled private workspace","420ResourceProtocol/420Store","does not prove 420Hz can physically erase","does not erase immutable Creative/chain","no rights, payment, Charts or Awards authority","never public Search/Indexer inputs","not a protocol constant","does not create public visibility"]:
        need(token in boundaries,f"authority boundary missing: {token}")

    inv=m.get("invariants",[])
    need(len(inv)==18,"expected HZGCA5-001..018")
    for i,x in enumerate(inv,1): need(x.startswith(f"HZGCA5-{i:03d} "),f"invariant numbering drift at {i}")

    for token in [
      "class DeterministicPrivateStorage420",
      "class ProjectWorkspace420",
      'PROJECT_VISIBILITY_420="PRIVATE"',
      "publicIndexRecords(){return [];}",
      "favoriteTake(",
      "selectTake(",
      "recordGeneration(",
      "verifyArtifacts(",
      "archive(",
      "restore(",
      "exportProject(",
      "deleteProject(",
      "sweepRetention(",
      "#assertQuota(",
      "tombstones",
      'storageClass:"HZ_PRIVATE_PRIMARY"',
      'status==="COMPLETE"',
      'status==="FAILED"||status==="CANCELLED"'
    ]:
        need(token in src,f"workspace implementation missing: {token}")

    for token in [
      "projects are private and never public-indexed",
      "parent-linked version tree",
      "complete take stores artifact manifest",
      "favorite and selected take require complete outputs",
      "failed and incomplete output sets",
      "quota exhaustion fails closed",
      "archive is private and bounded",
      "archive expiry deletes and tombstones",
      "export is access-controlled and expires in 24 hours",
      "delete revokes serving/indexing",
      "storage integrity tampering fails closed",
      "failed take retention is seven days",
      "365-day inactivity archives",
      "tombstone prevents replay resurrection"
    ]:
        need(token in tests,f"required HZ-GCA-5 test missing: {token}")

    # Retain exact HZ-GCA-1.8 policy semantics.
    rpol={x.get("id"):x for x in store.get("retentionPolicies",[])}
    need(rpol.get("failed-cancelled-generation-private",{}).get("maxRetention")=="7 days after terminal FAILED/CANCELLED","HZ-GCA-1.8 failed/cancelled retention drift")
    need(rpol.get("unsaved-generated-takes",{}).get("maxRetention")=="30 days after generation unless explicitly saved/pinned into an active project","HZ-GCA-1.8 unsaved retention drift")
    need(rpol.get("active-project-private",{}).get("maxRetention")=="365 days after last authenticated project activity unless refreshed by user activity/export/save policy","HZ-GCA-1.8 active retention drift")
    need(rpol.get("archived-project-private",{}).get("maxRetention")=="30 days after archive/expiry transition","HZ-GCA-1.8 archive retention drift")
    need(rpol.get("export-package",{}).get("maxRetention")=="24 hours after export package creation","HZ-GCA-1.8 export retention drift")
    need("deletion/tombstone wins over stale cache, replica, retry, replay and restore" in store.get("deletionSemantics",{}).get("antiResurrection",[]),"HZ-GCA-1.8 anti-resurrection drift")

    need(prov.get("canonicalStep")=="HZ-GCA-4","HZ-GCA-4 provenance prerequisite drift")
    need("project-workspace.js" in pkg.get("scripts",{}).get("check",""),"project workspace missing from syntax checks")
    need(pkg.get("scripts",{}).get("qualify")=="npm run check && npm test","generation qualification command drift")

    need("Projects are always `PRIVATE` and `indexable:false`." in doc,"privacy doc boundary missing")
    need("Quota limits are constructor/deployment configuration, not protocol constants." in doc,"quota doc boundary missing")
    need("publicIndexRecords()" in doc,"no-public-index doc missing")
    need("HZ-GCA-6 — 420Hz Generate Studio UX" in doc,"next canonical step missing")

    need("## HZ-GCA-5 — Project workspace, versions, stems and storage" in road,"canonical roadmap step missing")
    for token in ["private generation projects","generation history/version tree","favorite/selected takes","stem/artifact manifests","lyrics and metadata drafts","delete/archive/export","storage integrity hashes","quota/resource accounting","no accidental public indexing of drafts","safe handling of incomplete/failed output sets"]:
        need(token in road,f"canonical roadmap requirement missing: {token}")
    need("Level 1 ordinary app-scoped step" in road,"HZ-GCA-5 Level-1 classification missing")

    blob=json.dumps(m)+"\n"+src
    need(re.search(r"0x[a-fA-F0-9]{40}",blob) is None,"HZ-GCA-5 must not invent deployed addresses")
    need("https://" not in src and "http://" not in src,"HZ-GCA-5 must not invent production storage endpoints")
    need(m.get("nextCanonicalStep")=="HZ-GCA-6 — 420Hz Generate Studio UX","next canonical step drift")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-5 Project workspace versions stems storage",
  "qualificationLevel":1,
  "invariants":0 if errors else len(m.get("invariants",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
