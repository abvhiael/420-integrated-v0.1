//go:build blst

package recovery

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	cc "github.com/420integrated/420-integrated/consensus/crypto"
	"github.com/420integrated/420-integrated/consensus/crypto/bls"
	eng "github.com/420integrated/420-integrated/consensus/engine"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	ct "github.com/420integrated/420-integrated/consensus/types"
)

func fixture(t *testing.T) (Trust, []*bls.SecretKey) {
	t.Helper()
	trust := Trust{ChainID: 420, ProtocolVersion: 1, Genesis: ct.Checkpoint{Root: [32]byte{1}}, Execution: sys.SequenceAnchor{ChainID: 420, BlockHash: [32]byte{2}}, CommitteeRoot: [32]byte{3}}
	var keys []*bls.SecretKey
	for i := 0; i < 15; i++ {
		seed := sha256.Sum256([]byte(fmt.Sprintf("recovery-test-key-%d", i)))
		sk, pk, e := bls.SecretFromIKM(seed[:])
		if e != nil {
			t.Fatal(e)
		}
		pop, e := sk.ProofOfPossession(pk)
		if e != nil {
			t.Fatal(e)
		}
		keys = append(keys, sk)
		trust.Members = append(trust.Members, Member{PublicKey: pk, Proof: pop})
	}
	return trust, keys
}
func certified(t *testing.T, trust Trust, keys []*bls.SecretKey, parent *Record, previous, slot uint64, hash byte) Record {
	t.Helper()
	pr := trust.Genesis.Root
	pa := trust.Execution
	var pq ct.QuorumCertificate
	if parent != nil {
		pr = parent.Consensus.Header.HashTreeRoot()
		pa.BlockHash = parent.Consensus.Header.ExecutionPayloadHash
		pa.ExecutionBlock, _ = parseNumber(parent.Payload.BlockNumber)
		pq = parent.Certificate
	}
	outcomes := sys.FinalizedStakeOutcomes{Rotation: &sys.RotationSnapshotOutcome{Rotation: slot, EligibleSnapshot: 15}}
	b, e := sys.BuildStakeBatch(sys.DerivationContext{ChainID: 420, ExecutionBlock: pa.ExecutionBlock + 1, ParentHash: pa.BlockHash}, previous, outcomes)
	if e != nil {
		t.Fatal(e)
	}
	h := ct.ConsensusBlock{Slot: slot, Rotation: slot / ct.SlotsPerRotation, ParentConsensusRoot: pr, CommitteeRoot: trust.CommitteeRoot, LatestQC: pq, ExecutionPayloadHash: [32]byte{hash}, SystemCallBatchRoot: b.Root()}
	qc := ct.QuorumCertificate{Slot: slot, BlockRoot: h.HashTreeRoot(), ParentRoot: pr, CommitteeRoot: trust.CommitteeRoot, ProtocolVersion: 1, SignerBitmap: []byte{255, 7}}
	root := cc.SigningRoot(cc.DomainQC, 420, 1, qc.SigningDataRoot())
	var sigs []ct.BLSSignature
	for i := 0; i < 11; i++ {
		sig, e := keys[i].Sign(root[:])
		if e != nil {
			t.Fatal(e)
		}
		sigs = append(sigs, sig)
	}
	qc.AggregateSignature, e = bls.Aggregate(sigs)
	if e != nil {
		t.Fatal(e)
	}
	return Record{Consensus: ct.ConsensusBlockEnvelope{Header: h, Body: ct.ConsensusBlockBody{SystemCalls: b.Calls}}, Certificate: qc, Outcomes: outcomes, Payload: eng.ExecutionPayloadV3{BlockNumber: fmt.Sprintf("0x%x", b.ExecutionBlock), ParentHash: Hash(pa.BlockHash), BlockHash: Hash(h.ExecutionPayloadHash), ExtraData: string(Hash(b.Root())), Timestamp: fmt.Sprintf("0x%x", trust.Timestamp+slot*12), PrevRandao: Hash([32]byte{})}, ParentBeaconBlockRoot: Hash([32]byte{}), VersionedHashes: []eng.Hash32{}}
}
func parseNumber(n string) (uint64, error) {
	var x uint64
	_, e := fmt.Sscanf(n, "0x%x", &x)
	return x, e
}
func TestCertifiedHistoryFinalityAndAuthority(t *testing.T) {
	trust, keys := fixture(t)
	sig, _ := ProductionSignatures()
	if e := trust.validate(sig); e != nil {
		t.Fatal(e)
	}
	a := certified(t, trust, keys, nil, 0, 1, 10)
	b := certified(t, trust, keys, &a, 1, 2, 11)
	v := newView(trust)
	if _, _, e := v.add(trust, sig, a); e != nil {
		t.Fatal(e)
	}
	if _, _, e := v.add(trust, sig, b); e != nil {
		t.Fatal(e)
	}
	if v.tracker.Status().Finalized.Root != a.Certificate.BlockRoot {
		t.Fatal("existing one-child finality not restored")
	}
	alternative := certified(t, trust, keys, nil, 0, 1, 12)
	if _, _, e := v.add(trust, sig, alternative); !errors.Is(e, ErrFinalized) {
		t.Fatalf("cross-finalized branch: %v", e)
	}
	replacement := certified(t, trust, keys, &a, 1, 2, 13)
	if _, _, e := v.add(trust, sig, replacement); e != nil {
		t.Fatal(e)
	}
	if v.tracker.Status().Finalized.Root != a.Certificate.BlockRoot {
		t.Fatal("replacement changed finalized parent")
	}
	for name, mutate := range map[string]func(*Record){
		"signature": func(r *Record) { r.Certificate.AggregateSignature[0] ^= 1 },
		"committee": func(r *Record) { r.Certificate.CommitteeRoot = [32]byte{7} },
		"batch":     func(r *Record) { r.Outcomes.Rotation.Rotation++ },
		"execution": func(r *Record) { r.Payload.BlockHash = Hash([32]byte{17}) },
		"parentQC":  func(r *Record) { r.Consensus.Header.LatestQC.AggregateSignature[0] ^= 1 },
	} {
		t.Run(name, func(t *testing.T) {
			r := certified(t, trust, keys, &replacement, 2, 3, 14)
			mutate(&r)
			before := v.tracker.Status()
			if _, _, e := v.add(trust, sig, r); e == nil {
				t.Fatal("invalid record accepted")
			}
			if v.tracker.Status() != before {
				t.Fatal("invalid certificate advanced finality")
			}
		})
	}
	rogue := trust
	rogue.Members = append([]Member(nil), trust.Members...)
	rogue.Members[0].Proof[0] ^= 1
	if e := rogue.validate(sig); e == nil {
		t.Fatal("invalid proof accepted")
	}
}
func TestDurableIntentAndSequenceFailureClosed(t *testing.T) {
	trust, keys := fixture(t)
	c, _ := eng.NewClient("http://127.0.0.1:1", make([]byte, 32))
	dir := t.TempDir()
	s, e := Open(trust, dir, c, Options{})
	if e != nil {
		t.Fatal(e)
	}
	if _, e := Open(trust, dir, c, Options{}); e == nil {
		t.Fatal("two state owners allowed")
	}
	r := certified(t, trust, keys, nil, 0, 1, 10)
	if e = s.Queue(r); e != nil {
		t.Fatal(e)
	}
	r.Outcomes.Rotation.Rotation = 999 // queue owns a deep copy
	if s.history.Pending.Outcomes.Rotation.Rotation != 1 {
		t.Fatal("caller mutated durable authority")
	}
	if e = s.Reconcile(context.Background()); e == nil {
		t.Fatal("unavailable execution accepted")
	}
	if len(s.history.Entries) != 0 || s.Status().Settlement != trust.Execution {
		t.Fatal("unavailable execution advanced settlement")
	}
	s.Close()
	s, e = Open(trust, dir, c, Options{})
	if e != nil {
		t.Fatal(e)
	}
	if s.history.Pending == nil || len(s.history.Entries) != 0 {
		t.Fatal("pending evidence lost")
	}
	s.Close()
	p := filepath.Join(dir, "sequence.json")
	os.WriteFile(p, []byte("{corrupt"), 0600)
	s, e = Open(trust, dir, c, Options{})
	if e != nil {
		t.Fatal(e)
	}
	if _, _, e = s.validateJournal(); e == nil {
		t.Fatal("corrupt journal reset")
	}
	s.Close()
	raw, _ := os.ReadFile(filepath.Join(dir, "history.json"))
	var h history
	json.Unmarshal(raw, &h)
	h.Pending.Certificate.AggregateSignature[0] ^= 1
	h.Checksum = historyChecksum(h)
	raw, _ = json.Marshal(h)
	os.WriteFile(filepath.Join(dir, "history.json"), raw, 0600)
	if _, e = Open(trust, dir, c, Options{RepairSequence: true}); e == nil {
		t.Fatal("repair trusted forged history with recomputed checksum")
	}
}
func TestHistoryStrictJSON(t *testing.T) {
	for _, raw := range []string{`null`, `{"Schema":"a","Schema":"b"}`, `{"Schema":"a","schema":"b"}`, `{} {}`, `{"extra":true}`} {
		var h history
		if e := Decode([]byte(raw), &h); e == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
}

func TestCertifiedRotationHandoffRequiresPinnedConsecutiveBoundary(t *testing.T) {
	trust, keys := fixture(t)
	trust.LastRotation = 2
	sig, _ := ProductionSignatures()
	v := newView(trust)
	first := certified(t, trust, keys, nil, 0, 1, 20)
	if _, _, err := v.add(trust, sig, first); err != nil {
		t.Fatal(err)
	}
	for _, slot := range []uint64{ct.SlotsPerRotation + 1, 2 * ct.SlotsPerRotation} {
		record := certified(t, trust, keys, &first, 1, slot, 21)
		if _, _, err := v.add(trust, sig, record); err == nil {
			t.Fatalf("unauthenticated rotation jump accepted at slot %d", slot)
		}
	}
	handoff := certified(t, trust, keys, &first, 1, ct.SlotsPerRotation, 22)
	single := trust
	single.LastRotation = 0
	if _, _, err := v.add(single, sig, handoff); err == nil {
		t.Fatal("single-rotation trust accepted a later rotation")
	}
	if _, _, err := v.add(trust, sig, handoff); err != nil {
		t.Fatal(err)
	}
}
