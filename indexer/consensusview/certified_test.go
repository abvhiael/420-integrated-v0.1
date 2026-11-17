//go:build blst

package consensusview

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	cc "github.com/420integrated/420-integrated/consensus/crypto"
	"github.com/420integrated/420-integrated/consensus/crypto/bls"
	eng "github.com/420integrated/420-integrated/consensus/engine"
	rec "github.com/420integrated/420-integrated/consensus/recovery"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	ct "github.com/420integrated/420-integrated/consensus/types"
	"os"
	"path/filepath"
	"testing"
)

func fixture(t *testing.T) (rec.Trust, []*bls.SecretKey) {
	t.Helper()
	trust := rec.Trust{ChainID: 420, ProtocolVersion: 1, Genesis: ct.Checkpoint{Root: [32]byte{1}}, Execution: sys.SequenceAnchor{ChainID: 420, BlockHash: [32]byte{2}}, CommitteeRoot: [32]byte{3}}
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
		trust.Members = append(trust.Members, rec.Member{PublicKey: pk, Proof: pop})
	}
	return trust, keys
}
func certified(t *testing.T, trust rec.Trust, keys []*bls.SecretKey, parent *rec.Record, previous, slot uint64, hash byte) rec.Record {
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
	h := ct.ConsensusBlock{Slot: slot, ParentConsensusRoot: pr, CommitteeRoot: trust.CommitteeRoot, LatestQC: pq, ExecutionPayloadHash: [32]byte{hash}, SystemCallBatchRoot: b.Root()}
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
	return rec.Record{Consensus: ct.ConsensusBlockEnvelope{Header: h, Body: ct.ConsensusBlockBody{SystemCalls: b.Calls}}, Certificate: qc, Outcomes: outcomes, Payload: eng.ExecutionPayloadV3{BlockNumber: fmt.Sprintf("0x%x", b.ExecutionBlock), ParentHash: rec.Hash(pa.BlockHash), BlockHash: rec.Hash(h.ExecutionPayloadHash), ExtraData: string(rec.Hash(b.Root())), Timestamp: fmt.Sprintf("0x%x", trust.Timestamp+slot*12), PrevRandao: rec.Hash([32]byte{})}, ParentBeaconBlockRoot: rec.Hash([32]byte{}), VersionedHashes: []eng.Hash32{}}
}
func parseNumber(n string) (uint64, error) {
	var x uint64
	_, e := fmt.Sscanf(n, "0x%x", &x)
	return x, e
}

func hashFixture(v any) string {
	b, _ := json.Marshal(v)
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}
func TestCertifiedHistoryAttributionReplacementAndFailClosed(t *testing.T) {
	trust, keys := fixture(t)
	a := certified(t, trust, keys, nil, 0, 1, 10)
	old := certified(t, trust, keys, &a, 1, 2, 11)
	replacement := certified(t, trust, keys, &a, 1, 3, 12)
	dir := t.TempDir()
	h := struct {
		Schema, TrustHash string
		Entries           []rec.Record
		Pending           *rec.Record
		Checksum          string
	}{Schema: "420-certified-settlement-history-v1", TrustHash: hashFixture(trust), Entries: []rec.Record{a, old, replacement}}
	c := struct {
		Schema, TrustHash string
		Head, Finalized   ct.Checkpoint
		Settlement        sys.SequenceAnchor
		Checksum          string
	}{Schema: "420-settlement-checkpoint-v1", TrustHash: h.TrustHash, Head: ct.Checkpoint{Slot: 3, Root: replacement.Certificate.BlockRoot}, Finalized: ct.Checkpoint{Slot: 1, Root: a.Certificate.BlockRoot}, Settlement: sys.SequenceAnchor{ChainID: 420, ExecutionBlock: 2, BlockHash: replacement.Consensus.Header.ExecutionPayloadHash, LastSequence: 2}}
	write := func() {
		h.Checksum = ""
		h.Checksum = hashFixture(h)
		c.Checksum = ""
		c.Checksum = hashFixture(c)
		for name, v := range map[string]any{"history.json": h, "checkpoint.json": c, "trust.json": trust} {
			raw, _ := json.Marshal(v)
			if err := os.WriteFile(filepath.Join(dir, name), raw, 0600); err != nil {
				t.Fatal(err)
			}
		}
	}
	write()
	for i := 0; i < 3; i++ {
		p, err := NewCertified(dir, filepath.Join(dir, "trust.json"), hashFixture(trust), "")
		if err != nil {
			t.Fatal(err)
		}
		producer, ok, err := p.ProducerForBlock(string(replacement.Payload.BlockHash))
		if err != nil || !ok || producer.ConsensusSlot != 3 || !producer.Certified {
			t.Fatal(producer, ok, err)
		}
		if _, ok, err = p.ProducerForBlock(string(old.Payload.BlockHash)); err != nil || ok {
			t.Fatal("orphan attribution", err)
		}
		if _, err = p.Consensus(); err == nil {
			t.Fatal("invented future schedule")
		}
	}
	if _, err := NewCertified(dir, filepath.Join(dir, "trust.json"), fmt.Sprintf("%064x", 0), ""); err == nil {
		t.Fatal("wrong pin accepted")
	}
	h.Pending = &replacement
	write()
	if _, err := NewCertified(dir, filepath.Join(dir, "trust.json"), hashFixture(trust), ""); err == nil {
		t.Fatal("unsettled history accepted")
	}
	h.Pending = nil
	h.Entries = append(h.Entries, certified(t, trust, keys, nil, 0, 4, 13))
	write()
	if _, err := NewCertified(dir, filepath.Join(dir, "trust.json"), hashFixture(trust), ""); err == nil {
		t.Fatal("cross-finality history accepted")
	}
}
