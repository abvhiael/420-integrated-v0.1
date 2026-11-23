//go:build blst

// certified-producer is a keyless consensus block builder and strict QC
// collector. It NEVER signs, stores validator BLS keys, invents votes, or
// substitutes local fixture shares. The typed duties are fulfilled exclusively
// by independent fourtwentyd --protected-signing processes. The separate
// fourtwentyd --certified-settlement process remains the authoritative durable
// finality/execution state owner.
package main

import (
    "encoding/hex"
    "encoding/json"
    "reflect"
    "flag"
    "fmt"
    "os"
    "strconv"

    "github.com/420integrated/420-integrated/consensus/attestation"
    "github.com/420integrated/420-integrated/consensus/crypto/bls"
    "github.com/420integrated/420-integrated/consensus/engine"
    "github.com/420integrated/420-integrated/consensus/finality"
    "github.com/420integrated/420-integrated/consensus/proposer"
    "github.com/420integrated/420-integrated/consensus/recovery"
    "github.com/420integrated/420-integrated/consensus/signing"
    sys "github.com/420integrated/420-integrated/consensus/systemcall"
    ct "github.com/420integrated/420-integrated/consensus/types"
)

type plan struct {
    Parent *recovery.Record
    Previous uint64
    Slot uint64
    Outcomes sys.FinalizedStakeOutcomes
    Beacon engine.Hash32
    Payload engine.ExecutionPayloadV3
    ConsensusStateRoot ct.Root
}
type signedVote struct {
    Kind string
    Attestation ct.Attestation
    Result signing.Result
}
type signedProposal struct {
    Kind string
    Proposal *ct.ConsensusBlock
    Result signing.Result
}
type votesFile struct { Shares []signedVote }
type duties struct {
    ProposerSeat uint16
    Proposal signing.Duty
    Votes []signing.Duty
    Batch engine.SystemCallBatchV1
}

func require(ok bool, message string) {
    if !ok { fail(message) }
}
func fail(message string) { fmt.Fprintln(os.Stderr,"CERTIFIED_PRODUCER_REJECTED:",message); os.Exit(1) }
func load(path string, value any) {
    raw,err:=os.ReadFile(path)
    if err!=nil {fail("cannot read pinned input: "+err.Error())}
    if err=recovery.Decode(raw,value);err!=nil {fail("ambiguous/malformed pinned input: "+err.Error())}
}
func root(v engine.Hash32) ct.Root {
    r,e:=ct.ParseRoot(string(v))
    if e!=nil {fail("invalid execution hash: "+e.Error())}
    return r
}
func number(v string) uint64 {
    n,e:=strconv.ParseUint(v,0,64)
    if e!=nil {fail("invalid execution quantity")}
    return n
}
func trustPolicies(t recovery.Trust, policies []signing.Policy) {
    require(t.ChainID==ct.ChainID && t.ProtocolVersion==1 && t.Genesis.Slot==0 &&
        t.Genesis.Root!=(ct.Root{}) && t.CommitteeRoot!=(ct.Root{}) &&
        t.Execution.ChainID==ct.ChainID && t.Execution.ExecutionBlock==0 &&
        t.Execution.BlockHash!=(ct.Root{}) && len(t.Members)==15 && len(policies)==15,
        "exact 15-seat pinned trust and policy required")
    seen:=map[ct.BLSPubkey]bool{}
    ids:=map[uint64]bool{}
    for seat,p:=range policies {
        require(p.Validate()==nil && int(p.Seat)==seat &&
            p.Identity.PublicKey==t.Members[seat].PublicKey &&
            p.Identity.Genesis==t.Genesis.Root && p.Identity.ChainID==t.ChainID &&
            p.ProtocolVersion==t.ProtocolVersion && p.CommitteeRoot==t.CommitteeRoot &&
            !seen[p.Identity.PublicKey] && !ids[p.Identity.ValidatorID] &&
            bls.VerifyProofOfPossession(t.Members[seat].PublicKey,t.Members[seat].Proof),
            "untrusted, duplicate or misbound validator identity/PoP")
        seen[p.Identity.PublicKey]=true
        ids[p.Identity.ValidatorID]=true
    }
}
func prepare(t recovery.Trust, policies []signing.Policy, seed ct.Root, p plan) (duties, recovery.Record, sys.Batch) {
    rotation:=p.Slot/ct.SlotsPerRotation
    require(p.Slot>0 && t.AllowsRotation(rotation) &&
        p.ConsensusStateRoot!=(ct.Root{}), "slot, rotation or consensus state missing")
    var parentRoot ct.Root = t.Genesis.Root
    parentHash:=t.Execution.BlockHash
    parentNumber:=uint64(0)
    var lastQC ct.QuorumCertificate
    source:=t.Genesis
    if p.Parent!=nil {
        pr:=p.Parent
        parentRoot=pr.Consensus.Header.HashTreeRoot()
        parentHash=root(pr.Payload.BlockHash)
        parentNumber=number(pr.Payload.BlockNumber)
        source=ct.Checkpoint{Slot:pr.Consensus.Header.Slot,Root:parentRoot}
        require(pr.Certificate.BlockRoot==parentRoot && pr.Certificate.ParentRoot==pr.Consensus.Header.ParentConsensusRoot &&
            pr.Certificate.Slot==pr.Consensus.Header.Slot && pr.Certificate.CommitteeRoot==t.CommitteeRoot &&
            pr.Certificate.ProtocolVersion==1 && pr.Consensus.Header.CommitteeRoot==t.CommitteeRoot &&
            pr.Consensus.Header.Slot<p.Slot && parentNumber>0 &&
            finality.VerifyQC(pr.Certificate,keys(t),t.ChainID,bls.ProductionVerifier{})==nil,
            "unauthenticated or out-of-order certified parent")
        parentRotation:=pr.Consensus.Header.Slot/ct.SlotsPerRotation
        require(pr.Consensus.Header.Rotation==parentRotation && t.AllowsRotation(parentRotation) &&
            (rotation==parentRotation || (rotation>parentRotation && rotation-parentRotation==1 &&
                p.Slot%ct.SlotsPerRotation==0)), "missing consecutive certified rotation handoff")
        lastQC=pr.Certificate
        expectedPrevious:=uint64(0)
        for _,call:=range pr.Consensus.Body.SystemCalls {
            require(call.ChainID==t.ChainID && call.ExecutionBlock==parentNumber,
                "parent has wrong system-call context")
            if call.Sequence>expectedPrevious {expectedPrevious=call.Sequence}
        }
        require(expectedPrevious==p.Previous && pr.Consensus.Header.SystemCallBatchRoot==
            pr.Consensus.SystemCallBatch(t.ChainID,parentNumber,root(pr.Payload.ParentHash)).Root(),
            "parent sequence/body commitment mismatch")
    } else {
        require(p.Slot==1 && p.Previous==0,"missing certified parent")
    }
    require(root(p.Payload.ParentHash)==parentHash && number(p.Payload.BlockNumber)==parentNumber+1 &&
        number(p.Payload.Timestamp)==t.Timestamp+p.Slot*ct.SlotSeconds &&
        p.Beacon!=(engine.Hash32("")), "execution parent, height, timestamp or beacon mismatch")
    batch,e:=sys.BuildStakeBatch(sys.DerivationContext{
        ChainID:t.ChainID,ExecutionBlock:parentNumber+1,ParentHash:parentHash},p.Previous,p.Outcomes)
    if e!=nil {fail("invalid Stake outcome: "+e.Error())}
    require(engine.VerifyPayloadSystemCallRoot(p.Payload,batch)==nil &&
        root(p.Payload.PrevRandao)==batch.Root(), "execution payload not bound to finalized Stake batch")
    seats:=make([]uint16,15)
    for i:=range seats {seats[i]=uint16(i)}
    schedule,e:=proposer.GenerateRotationSchedule(seats,seed,rotation)
    if e!=nil {fail("cannot derive pinned proposer schedule: "+e.Error())}
    scheduled:=schedule[p.Slot%ct.SlotsPerRotation].Primary
    block:=ct.ConsensusBlock{Slot:p.Slot,ProposerSeat:scheduled,ProposerRank:0,
        ParentConsensusRoot:parentRoot,ExecutionPayloadHash:root(p.Payload.BlockHash),
        ConsensusStateRoot:p.ConsensusStateRoot,CommitteeRoot:t.CommitteeRoot,Rotation:rotation,
        LatestQC:lastQC,RandomnessContext:root(p.Payload.PrevRandao),SystemCallBatchRoot:batch.Root()}
    blockRoot:=block.HashTreeRoot()
    vote:=ct.AttestationData{Slot:p.Slot,BlockRoot:blockRoot,ParentRoot:parentRoot,
        Source:source,Target:ct.Checkpoint{Slot:p.Slot,Root:blockRoot}}
    result:=duties{ProposerSeat:scheduled,Batch:engine.EncodeSystemCallBatch(batch),
        Votes:make([]signing.Duty,15)}
    for i,pol:=range policies {
        result.Votes[i]=signing.Duty{ChainID:t.ChainID,Genesis:t.Genesis.Root,
            ValidatorID:pol.Identity.ValidatorID,ProtocolVersion:1,Kind:"qc-vote",Vote:&vote}
    }
    result.Proposal=signing.Duty{ChainID:t.ChainID,Genesis:t.Genesis.Root,
        ValidatorID:policies[scheduled].Identity.ValidatorID,ProtocolVersion:1,
        Kind:"proposal",Proposal:&block}
    record:=recovery.Record{Consensus:ct.ConsensusBlockEnvelope{
        Header:block,Body:ct.ConsensusBlockBody{SystemCalls:batch.Calls}},
        Outcomes:p.Outcomes,Payload:p.Payload,VersionedHashes:[]engine.Hash32{},
        ParentBeaconBlockRoot:p.Beacon}
    return result,record,batch
}
func keys(t recovery.Trust) []ct.BLSPubkey {
    result:=make([]ct.BLSPubkey,len(t.Members))
    for i,m:=range t.Members {result[i]=m.PublicKey}
    return result
}
func verifyProposal(d signing.Duty, p signing.Policy, s signedProposal) {
    require(s.Kind=="proposal" && s.Proposal!=nil && d.Proposal!=nil &&
        reflect.DeepEqual(*s.Proposal,*d.Proposal) && s.Result.PublicKey==p.Identity.PublicKey,
        "missing/mismatched independently signed proposer duty")
    wanted,e:=p.Root(d)
    require(e==nil && s.Result.SigningRoot==wanted &&
        bls.Verify(p.Identity.PublicKey,wanted[:],s.Result.Signature),
        "invalid domain-separated proposer signature")
}
func certify(t recovery.Trust, policies []signing.Policy, prepared duties, r recovery.Record, votes []signedVote) recovery.Record {
    data:=*prepared.Votes[0].Vote
    collector:=attestation.NewCollector(15,data)
    for _,share:=range votes {
        seat:=int(share.Attestation.Seat)
        require(seat>=0 && seat<15 && share.Kind=="qc-vote" &&
            share.Attestation.Data==data &&
            share.Result.PublicKey==policies[seat].Identity.PublicKey &&
            share.Result.Signature==share.Attestation.Signature,
            "invalid seat, vote, committee identity or signature binding")
        expected,e:=policies[seat].Root(prepared.Votes[seat])
        require(e==nil && share.Result.SigningRoot==expected &&
            bls.Verify(share.Result.PublicKey,expected[:],share.Result.Signature),
            "forged, wrong-domain or wrong-key protected vote")
        if e=collector.Add(share.Attestation);e!=nil {fail("repeated/invalid validator vote: "+e.Error())}
    }
    require(collector.HasQuorum(),"11/15 genuine independent protected signatures required")
    qc,e:=collector.AssembleQC(1,t.CommitteeRoot,aggregator{})
    if e!=nil {fail("QC aggregation failed: "+e.Error())}
    if e=finality.VerifyQC(qc,keys(t),t.ChainID,bls.ProductionVerifier{});e!=nil {
        fail("aggregated BLS verification failed: "+e.Error())
    }
    r.Certificate=qc
    return r
}
type aggregator struct{}
func (aggregator) Aggregate(s []ct.BLSSignature) (ct.BLSSignature,error) {return bls.Aggregate(s)}
func main(){
    trustPath:=flag.String("trust","","independently pinned chain/committee")
    policiesPath:=flag.String("policies","","public per-seat signer policy manifest")
    planPath:=flag.String("plan","","actual Geth payload and finalized Stake outcomes")
    seedText:=flag.String("rotation-seed","","independently configured proposer schedule seed")
    mode:=flag.String("mode","","batch | duties | certify")
    proposalPath:=flag.String("proposal","","protected proposer process output")
    votesPath:=flag.String("votes","","protected validator process outputs")
    flag.Parse()
    var trust recovery.Trust;load(*trustPath,&trust)
    var policies []signing.Policy;load(*policiesPath,&policies)
    trustPolicies(trust,policies)
    seedRaw,e:=hex.DecodeString(*seedText)
    require(e==nil && len(seedRaw)==32,"32-byte pinned rotation seed required")
    var seed ct.Root;copy(seed[:],seedRaw)
    var p plan;load(*planPath,&p)
    if *mode=="batch" {
        // Prior to payload construction only the authenticated parent context
        // and consensus-derived Stake outcomes exist; no QC is created here.
        parentHash:=trust.Execution.BlockHash
        previous:=uint64(0)
        height:=uint64(1)
        if p.Parent!=nil {
            parentHash=root(p.Parent.Payload.BlockHash)
            height=number(p.Parent.Payload.BlockNumber)+1
            previous=p.Previous
        }
        require(p.Slot>0 && trust.AllowsRotation(p.Slot/ct.SlotsPerRotation) &&
            number(p.Payload.BlockNumber)==height && root(p.Payload.ParentHash)==parentHash,
            "candidate batch not bound to authenticated native parent")
        batch,err:=sys.BuildStakeBatch(sys.DerivationContext{ChainID:trust.ChainID,
            ExecutionBlock:height,ParentHash:parentHash},previous,p.Outcomes)
        if err!=nil {fail(err.Error())}
        json.NewEncoder(os.Stdout).Encode(engine.EncodeSystemCallBatch(batch))
        return
    }
    prepared,record,_:=prepare(trust,policies,seed,p)
    if *mode=="duties" {
        json.NewEncoder(os.Stdout).Encode(prepared);return
    }
    require(*mode=="certify" && *proposalPath!="" && *votesPath!="",
        "explicit certified-producer mode and protected receipts required")
    var prop signedProposal;load(*proposalPath,&prop)
    verifyProposal(prepared.Proposal,policies[prepared.ProposerSeat],prop)
    var votes votesFile;load(*votesPath,&votes)
    result:=certify(trust,policies,prepared,record,votes.Shares)
    json.NewEncoder(os.Stdout).Encode(result)
}
