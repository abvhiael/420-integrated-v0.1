//go:build blst

// This program is an explicitly insecure LOCAL qualification producer, never a
// validator signer. Known deterministic test keys must not be deployed.
package main

import (
	"crypto/sha256"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"

	cc "github.com/420integrated/420-integrated/consensus/crypto"
	"github.com/420integrated/420-integrated/consensus/crypto/bls"
	eng "github.com/420integrated/420-integrated/consensus/engine"
	"github.com/420integrated/420-integrated/consensus/finality"
	rec "github.com/420integrated/420-integrated/consensus/recovery"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	ct "github.com/420integrated/420-integrated/consensus/types"
)

func keys() (rec.Trust, []*bls.SecretKey) {
	t := rec.Trust{ChainID: 420, ProtocolVersion: 1, Genesis: ct.Checkpoint{Root: sha256.Sum256([]byte("420/recovery/LOCAL-TEST-GENESIS"))}, CommitteeRoot: sha256.Sum256([]byte("420/recovery/LOCAL-TEST-COMMITTEE"))}
	var keys []*bls.SecretKey
	for i := 0; i < 15; i++ {
		seed := sha256.Sum256([]byte(fmt.Sprintf("INSECURE-LOCAL-RECOVERY-KEY-%d", i)))
		sk, pk, e := bls.SecretFromIKM(seed[:])
		if e != nil {
			panic(e)
		}
		pop, e := sk.ProofOfPossession(pk)
		if e != nil {
			panic(e)
		}
		keys = append(keys, sk)
		t.Members = append(t.Members, rec.Member{PublicKey: pk, Proof: pop})
	}
	return t, keys
}
func main() {
	protectedDir := flag.String("provision-protected", "", "LOCAL ONLY: initialize fixture signer policy and validator history")
	committeeDir := flag.String("provision-protected-committee", "", "LOCAL ONLY: 15 independent public test-only signing identities")
	protectedConfig := flag.String("protected-config", "", "require production protected seat-zero vote, never fall back")
	genesis := flag.String("genesis", "", "execution genesis hash for local fixture")
	timestamp := flag.String("timestamp", "0x0", "genesis timestamp")
	deriveOnly := flag.Bool("batch", false, "derive the canonical batch instead of certifying a payload")
	plan := flag.String("record", "", "JSON plan to certify")
	flag.Parse()
	if *protectedDir != "" {
		provisionProtected(*protectedDir)
		return
	}
	if *committeeDir != "" {
		provisionProtectedCommittee(*committeeDir,*genesis,*timestamp)
		return
	}
	t, keys := keys()
	if *protectedConfig != "" {
		keys[0].Destroy()
	}
	if *genesis != "" {
		h, e := ct.ParseRoot(*genesis)
		if e != nil {
			panic(e)
		}
		ts, e := strconv.ParseUint(strings.TrimPrefix(*timestamp, "0x"), 16, 64)
		if e != nil {
			panic(e)
		}
		t.Timestamp = ts
		t.Execution = sys.SequenceAnchor{ChainID: 420, BlockHash: h}
		json.NewEncoder(os.Stdout).Encode(t)
		return
	}
	var p struct {
		Parent       *rec.Record
		Payload      eng.ExecutionPayloadV3
		Outcomes     sys.FinalizedStakeOutcomes
		Slot         uint64
		Previous     uint64
		Beacon       eng.Hash32
		BadSignature bool
	}
	raw, e := os.ReadFile(*plan)
	if e != nil {
		panic(e)
	}
	if e = rec.Decode(raw, &p); e != nil {
		panic(e)
	}
	parent := t.Genesis.Root
	var qc ct.QuorumCertificate
	if p.Parent != nil {
		parent = p.Parent.Consensus.Header.HashTreeRoot()
		qc = p.Parent.Certificate
	}
	n, e := strconv.ParseUint(strings.TrimPrefix(p.Payload.BlockNumber, "0x"), 16, 64)
	if e != nil {
		panic(e)
	}
	ph, e := ct.ParseRoot(string(p.Payload.ParentHash))
	if e != nil {
		panic(e)
	}
	batch, e := sys.BuildStakeBatch(sys.DerivationContext{ChainID: 420, ExecutionBlock: n, ParentHash: ph}, p.Previous, p.Outcomes)
	if e != nil {
		panic(e)
	}
	if *deriveOnly {
		json.NewEncoder(os.Stdout).Encode(eng.EncodeSystemCallBatch(batch))
		return
	}
	hash, e := ct.ParseRoot(string(p.Payload.BlockHash))
	if e != nil {
		panic(e)
	}
	randao, e := ct.ParseRoot(string(p.Payload.PrevRandao))
	if e != nil {
		panic(e)
	}
	header := ct.ConsensusBlock{RandomnessContext: randao, Slot: p.Slot, ParentConsensusRoot: parent, ExecutionPayloadHash: hash, SystemCallBatchRoot: batch.Root(), CommitteeRoot: t.CommitteeRoot, LatestQC: qc}
	cert := ct.QuorumCertificate{Slot: p.Slot, BlockRoot: header.HashTreeRoot(), ParentRoot: parent, CommitteeRoot: t.CommitteeRoot, ProtocolVersion: 1, SignerBitmap: make([]byte, finality.BitmapBytes(15))}
	for i := 0; i < 11; i++ {
		finality.SetSeat(cert.SignerBitmap, i)
	}
	root := cc.SigningRoot(cc.DomainQC, 420, 1, cert.SigningDataRoot())
	var sigs []ct.BLSSignature
	for i := 0; i < 11; i++ {
		var sig ct.BLSSignature
		var e error
		if i == 0 && *protectedConfig != "" {
			source := t.Genesis
			if p.Parent != nil {
				source = ct.Checkpoint{Slot: p.Parent.Certificate.Slot, Root: p.Parent.Certificate.BlockRoot}
			}
			sig, e = protectedVote(*protectedConfig, cert, source)
		} else {
			sig, e = keys[i].Sign(root[:])
		}
		if e != nil {
			panic(e)
		}
		sigs = append(sigs, sig)
	}
	cert.AggregateSignature, e = bls.Aggregate(sigs)
	if e != nil {
		panic(e)
	}
	if p.BadSignature {
		cert.AggregateSignature[0] ^= 1
	}
	r := rec.Record{Consensus: ct.ConsensusBlockEnvelope{Header: header, Body: ct.ConsensusBlockBody{SystemCalls: batch.Calls}}, Certificate: cert, Payload: p.Payload, Outcomes: p.Outcomes, VersionedHashes: []eng.Hash32{}, ParentBeaconBlockRoot: p.Beacon}
	json.NewEncoder(os.Stdout).Encode(r)
}
