#!/usr/bin/env python3
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
COMM=ROOT/"hz"/"config"/"gca-community-authority-v1.json"
OBJECTS=ROOT/"hz"/"config"/"gca-object-model-v1.json"
PRIV=ROOT/"hz"/"config"/"gca-privacy-v1.json"
STORE=ROOT/"hz"/"config"/"gca-storage-retention-v1.json"
DOC=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1.10-COMMUNITY-AUTHORITY.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [COMM,OBJECTS,PRIV,STORE,DOC,ROADMAP]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    comm=json.loads(COMM.read_text())
    objects=json.loads(OBJECTS.read_text())
    priv=json.loads(PRIV.read_text())
    store=json.loads(STORE.read_text())
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()

    need(comm.get("schema")=="420hz-gca-community-authority-v1","community schema drift")
    need(comm.get("version")==1,"community version drift")
    need(comm.get("canonicalStep")=="HZ-GCA-1","canonical parent step drift")
    need(comm.get("workPackage")=="HZ-GCA-1.10","work package drift")
    need(comm.get("level")==1,"HZ-GCA-1.10 must remain Level 1")
    need(comm.get("milestoneRequired") is False,"HZ-GCA-1.10 must not become Level-2 milestone")

    need(objects.get("workPackage")=="HZ-GCA-1.2","HZ-GCA-1.2 prerequisite drift")
    need(priv.get("workPackage")=="HZ-GCA-1.7","HZ-GCA-1.7 prerequisite drift")
    need(store.get("workPackage")=="HZ-GCA-1.8","HZ-GCA-1.8 prerequisite drift")

    auth=comm.get("authority",{})
    need(auth.get("hzOwned")==["ArtistFollow","RecordingFavorite","Playlist","PlaylistItem"],"420Hz-owned community object set drift")
    need("CommunityActivity" in auth.get("derivedOnly",[]),"CommunityActivity must remain derived")
    ext=auth.get("externalAuthorities",{})
    for key in ["wallet","identity","creative","commons","town","search","notifications","awards","charts","governance"]:
        need(isinstance(ext.get(key),str) and ext[key].strip(),f"external authority missing: {key}")

    access=comm.get("accessModel",{})
    need("read PUBLIC creator/community presentation" in access.get("anonymous",[]),"anonymous public-read rule missing")
    for action in ["follow/unfollow artist","favorite/unfavorite Recording","create/update/delete own playlist","add/remove/reorder items in own playlist"]:
        need(action in access.get("walletAuthorized",[]),f"Wallet-authorized action missing: {action}")
    forbidden=" ".join(access.get("forbidden",[]))
    for token in ["client-provided account string","Wallet connection alone","Identity profile selection","Search/Indexer/Notifications cache"]:
        need(token in forbidden,f"access no-authority rule missing: {token}")

    rules={x.get("type"):x for x in comm.get("objectRules",[])}
    expected={"ArtistFollow","RecordingFavorite","Playlist","PlaylistItem"}
    need(set(rules)==expected,f"community object-rule set drift: {sorted(set(rules)^expected)}")
    need("followerAccountRef + artistCreatorId" in rules["ArtistFollow"].get("keySemantics",""),"ArtistFollow key semantics drift")
    need(rules["RecordingFavorite"].get("visibility","").startswith("PRIVATE"),"RecordingFavorite must remain private by default")
    need(rules["Playlist"].get("visibility")=="PRIVATE | UNLISTED | PUBLIC","Playlist visibility vocabulary drift")
    need("inherits playlist visibility" in rules["PlaylistItem"].get("visibility",""),"PlaylistItem visibility inheritance missing")

    share=" ".join(comm.get("shareRepostRules",[]))
    for token in ["non-authoritative reference/deep-link","does not make it searchable or PUBLIC","cannot grant access to PRIVATE","original canonical Recording/release"]:
        need(token in share,f"share/repost rule missing: {token}")

    activity=" ".join(comm.get("activityProjectionRules",[]))
    for token in ["derived/rebuildable","preserve sourceType/sourceId/sourceRevision","cannot create new follow/favorite/playlist state","may never exceed the visibility","presentation metrics"]:
        need(token in activity,f"activity projection rule missing: {token}")

    src=" ".join(comm.get("sourceObjectRules",[]))
    for token in ["native canonical Creator/Recording IDs","does not make an unavailable, deleted, unlisted, private or rights-blocked Recording playable/discoverable","Source visibility/readiness/rights checks remain authoritative","fail closed or mark unavailable"]:
        need(token in src,f"source-object rule missing: {token}")

    privacy=" ".join(comm.get("privacyRules",[]))
    for token in ["ArtistFollow current default is PUBLIC","RecordingFavorite defaults PRIVATE","PRIVATE, UNLISTED and PUBLIC","Private favorites/playlists do not enter public Search","UNLISTED playlists"]:
        need(token in privacy,f"community privacy rule missing: {token}")

    mod=" ".join(comm.get("moderationInteraction",[]))
    need("HZ-GCA-1.14" in mod,"moderation authority deferral missing")
    need("comments/replies remain deferred" in mod,"comments deferral missing")
    need("must not silently fabricate unfollow/unfavorite" in mod,"block/mute no-fabricated-mutation rule missing")

    ca=" ".join(comm.get("chartAwardsSeparation",[]))
    for token in ["not automatically qualified chart events","does not itself qualify","AwardVote is a separate","HZ-GCA-1.11","HZ-GCA-1.12/1.13"]:
        need(token in ca,f"Charts/Awards separation missing: {token}")

    ns=" ".join(comm.get("notificationSearchRules",[]))
    for token in ["only PUBLIC eligible","never mutate the source relation","does not roll back","does not delete community source state","does not bypass Wallet/session authorization"]:
        need(token in ns,f"Search/Notifications rule missing: {token}")

    di=" ".join(comm.get("deletionAndIdempotencyRules",[]))
    for token in ["idempotent by logical relation key","cannot create duplicate active relations","stable item identities/revisions","must not resurrect","do not erase immutable external"]:
        need(token in di,f"deletion/idempotency rule missing: {token}")

    failures=set(comm.get("failureRules",[]))
    for f in [
      "mutation without qualified Wallet/session actor authority fails closed",
      "duplicate follow/favorite replay cannot create duplicate active relation",
      "playlist mutation by non-owner/non-controller fails closed",
      "private favorite or private playlist entering public Search/activity fails closed",
      "UNLISTED playlist entering broad Search/trending fails closed",
      "comments/replies cannot be enabled before later moderation/reporting requirements are satisfied"
    ]:
        need(f in failures,f"community failure rule missing: {f}")

    inv=comm.get("invariants",[])
    need(len(inv)==18,"expected HZGCA-COM-001..018")
    for i,x in enumerate(inv,1):
        need(x.startswith(f"HZGCA-COM-{i:03d} "),f"invariant numbering drift at {i}")

    object_types={x.get("type") for x in objects.get("objects",[])}
    for t in expected|{"CommunityActivity"}:
        need(t in object_types,f"HZ-GCA-1.2 object prerequisite missing: {t}")

    priv_rules={x.get("data"):x for x in priv.get("dataRules",[])}
    need(priv_rules.get("favorite",{}).get("class")=="PRIVATE","HZ-GCA-1.7 favorite privacy drift")
    need(priv_rules.get("playlistPrivate",{}).get("class")=="PRIVATE","HZ-GCA-1.7 private playlist drift")
    need(priv_rules.get("playlistUnlisted",{}).get("class")=="UNLISTED","HZ-GCA-1.7 unlisted playlist drift")
    need(priv_rules.get("playlistPublic",{}).get("class")=="PUBLIC","HZ-GCA-1.7 public playlist drift")

    for source in comm.get("sourceDocs",[]):
        need((ROOT/source).is_file(),f"missing reconciled community source: {source}")

    for token in [
      "Eligible PUBLIC community presentation may be read anonymously.",
      "Wallet connection alone is not approval.",
      "A favorite is **PRIVATE by default**",
      "A PUBLIC playlist cannot make an otherwise PRIVATE, UNLISTED, deleted, unavailable or rights-blocked Recording publicly playable/searchable.",
      "420Hz Community follows/favorites/playlists are not alternate Commons/Town membership, roles or votes.",
      "Comments/replies remain deferred",
      "HZ-GCA-1.11 — Define Charts rules"
    ]:
        need(token in doc,f"normative Community token missing: {token}")

    need("HZ-GCA-1.10 — Define Community authority model" in roadmap,"roadmap HZ-GCA-1.10 missing")
    need("machine-readable Community authority manifest" in roadmap,"roadmap Community deliverable missing")
    need("Level 1 only" in roadmap,"roadmap Level-1 classification missing")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-1.10 Community authority model",
  "level":1,
  "communityObjects":0 if errors else len(comm.get("objectRules",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
