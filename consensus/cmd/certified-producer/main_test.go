//go:build blst

package main

import (
    "crypto/sha256"
    "fmt"
    "testing"

    "github.com/420integrated/420-integrated/consensus/crypto/bls"
    "github.com/420integrated/420-integrated/consensus/finality"
    "github.com/420integrated/420-integrated/consensus/recovery"
    "github.com/420integrated/420-integrated/consensus/signing"
    "github.com/420integrated/420-integrated/consensus/slashing"
    ct "github.com/420integrated/420-integrated/consensus/types"
)

func TestRealIndependentBLSSharesAggregateOnlyUnderPinnedCommittee(t *testing.T) {
    var root ct.Root
    root[0]=3
    var block ct.Root
    block[0]=7
    var parent ct.Root
    parent[0]=5
    trust:=recovery.Trust{ChainID:420,ProtocolVersion:1,
        Genesis:ct.Checkpoint{Slot:0,Root:root},
        CommitteeRoot:sha256.Sum256([]byte("GOV-PRE-08-test-committee"))}
    trust.Execution.ChainID=420
    trust.Execution.BlockHash=sha256.Sum256([]byte("GOV-PRE-08-test-execution"))
    policy:=make([]signing.Policy,15)
    prepared:=duties{Votes:make([]signing.Duty,15)}
    data:=ct.AttestationData{Slot:1,BlockRoot:block,ParentRoot:parent,
        Source:trust.Genesis,Target:ct.Checkpoint{Slot:1,Root:block}}
    shares:=make([]signedVote,15)
    for seat:=0;seat<15;seat++ {
        ikm:=sha256.Sum256([]byte(fmt.Sprintf("TEST ONLY key %d",seat)))
        key,pk,err:=bls.SecretFromIKM(ikm[:])
        if err!=nil {t.Fatal(err)}
        pop,err:=key.ProofOfPossession(pk)
        if err!=nil {t.Fatal(err)}
        trust.Members=append(trust.Members,recovery.Member{PublicKey:pk,Proof:pop})
        p:=signing.Policy{Identity:slashing.HistoryIdentity{ChainID:420,
            Genesis:root,ValidatorID:uint64(96+seat),PublicKey:pk},ProtocolVersion:1,
            CommitteeRoot:trust.CommitteeRoot,Seat:uint16(seat)}
        policy[seat]=p
        duty:=signing.Duty{ChainID:420,Genesis:root,
            ValidatorID:p.Identity.ValidatorID,ProtocolVersion:1,Kind:"qc-vote",Vote:&data}
        prepared.Votes[seat]=duty
        signingRoot,err:=p.Root(duty)
        if err!=nil {t.Fatal(err)}
        sig,err:=key.Sign(signingRoot[:])
        key.Destroy()
        if err!=nil {t.Fatal(err)}
        shares[seat]=signedVote{Kind:"qc-vote",
            Attestation:ct.Attestation{Seat:uint16(seat),Data:data,Signature:sig},
            Result:signing.Result{PublicKey:pk,SigningRoot:signingRoot,Signature:sig}}
    }
    trustPolicies(trust,policy,trust.Rotation)
    for _,size:=range []int{11,15} {
        r:=certify(trust,policy,prepared,recovery.Record{Consensus:ct.ConsensusBlockEnvelope{Header:ct.ConsensusBlock{CommitteeRoot:trust.CommitteeRoot}}},shares[:size])
        count,err:=finality.CountSigners(r.Certificate.SignerBitmap,15)
        if err!=nil || count!=size {t.Fatalf("wrong signer quorum: %d %v",count,err)}
        if err=finality.VerifyQC(r.Certificate,keys(trust,trust.Rotation),420,bls.ProductionVerifier{});err!=nil {
            t.Fatalf("assembled independently signed QC not cryptographically valid: %v",err)
        }
        if r.Certificate.BlockRoot!=block || r.Certificate.ParentRoot!=parent {
            t.Fatal("aggregated QC drifted from exact typed vote")
        }
    }
}
