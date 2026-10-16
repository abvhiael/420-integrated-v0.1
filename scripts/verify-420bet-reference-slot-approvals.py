#!/usr/bin/env python3
"""Fail-closed external review gate. Verifies three distinct Ed25519 approvers.

Signatures are over identical canonical JSON decision payloads, verified with
OpenSSL. Approved reviewers and keys must be independently maintained and
reviewer may not be the implementation author or another review role.
"""
import base64
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROLES=("target_rtp_policy","independent_rtp_mathematics","bankroll_liability")
def canon(obj):
    return json.dumps(obj,sort_keys=True,separators=(",",":"),ensure_ascii=True).encode()

def verify(file):
    doc=json.loads(Path(file).read_text())
    candidate=doc["candidate"]
    if not isinstance(candidate.get("fixtureSha256"),str) or len(candidate["fixtureSha256"])!=64:
        raise ValueError("candidate fixture digest missing")
    if not isinstance(candidate.get("stakeSmallestUnits"),int) or candidate["stakeSmallestUnits"]<=0:
        raise ValueError("stake invalid")
    if candidate.get("maxNetBankrollLiabilitySmallestUnits")!=candidate.get("grossCapSmallestUnits",0)-candidate["stakeSmallestUnits"]:
        raise ValueError("liability cap mismatch")
    trust=json.loads(Path(doc["trustedReviewerRegistryPath"]).read_text())
    approvals=doc["approvals"]
    seen=set()
    if set(approvals)!=set(ROLES): raise ValueError("all three approvals mandatory")
    for role in ROLES:
        a=approvals[role]
        if a.get("decision")!="APPROVED": raise ValueError(role+" is not approved")
        identity=a["reviewerId"]
        if identity in seen or identity==doc["implementationAuthorId"]:
            raise ValueError("reviewers must be independent and distinct")
        allowed=trust.get(role,{}).get(identity)
        if not allowed or allowed!=a["publicKeyPem"]:
            raise ValueError(role+" reviewer is not pinned in the trusted authority registry")
        seen.add(identity)
        signed={"role":role,"reviewerId":identity,"decision":"APPROVED","candidate":candidate}
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/"message").write_bytes(canon(signed))
            (root/"public.pem").write_text(a["publicKeyPem"])
            (root/"signature").write_bytes(base64.b64decode(a["signatureBase64"],validate=True))
            res=subprocess.run(["openssl","pkeyutl","-verify","-pubin","-inkey",str(root/"public.pem"),
                "-rawin","-in",str(root/"message"),"-sigfile",str(root/"signature")],
                capture_output=True,text=True)
            if res.returncode: raise ValueError(role+" cryptographic signature invalid")
    return True

if __name__=="__main__":
    if len(sys.argv)!=2: sys.exit("usage: verify-420bet-reference-slot-approvals.py <review-packet.json>")
    try:
        verify(sys.argv[1])
    except (KeyError,ValueError,FileNotFoundError) as exc:
        sys.exit("RELEASE BLOCKED: "+str(exc))
    print("APPROVAL GATE PASS: independent signed RTP target, mathematics and liability decisions")
