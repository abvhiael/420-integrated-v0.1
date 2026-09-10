package storage

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
	"time"
)

type fakeChain struct { assignments map[string]Assignment }
func (f fakeChain) Assignment(_ context.Context, id string) (Assignment, error) {
	a, ok := f.assignments[id]
	if !ok { return Assignment{}, ErrInactiveAssignment }
	return a, nil
}

type fakeSubmitter struct { proofs []Proof }
func (f *fakeSubmitter) SubmitProof(_ context.Context, proof Proof) error {
	f.proofs = append(f.proofs, proof)
	return nil
}

func assignmentFor(data []byte, commitmentID string, nodeID string) Assignment {
	h := sha256.Sum256(data)
	return Assignment{
		AgreementID: "agreement-1",
		CommitmentID: commitmentID,
		NodeID: nodeID,
		ShardRoot: hex.EncodeToString(h[:]),
		SizeBytes: uint64(len(data)),
		StartTime: time.Now().Add(-time.Minute),
		EndTime: time.Now().Add(time.Hour),
		Active: true,
	}
}

func TestStoreRetrieveRestartAndDelete(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	data := []byte("420-store-shard")
	a := assignmentFor(data, "commitment-1", "node-1")
	chain := fakeChain{assignments: map[string]Assignment{a.CommitmentID: a}}
	store, err := OpenFileStore(root)
	if err != nil { t.Fatal(err) }
	r, err := NewRuntime("node-1", 1024, store, chain, nil)
	if err != nil { t.Fatal(err) }
	if _, err := r.StoreShard(ctx, a.CommitmentID, bytes.NewReader(data)); err != nil { t.Fatal(err) }
	if got := r.Capacity().UsedBytes; got != uint64(len(data)) { t.Fatalf("used=%d", got) }
	part, rec, err := r.Retrieve(ctx, a.CommitmentID, 4, 5)
	if err != nil { t.Fatal(err) }
	if string(part) != string(data[4:9]) { t.Fatalf("range=%q", part) }
	if rec.ShardRoot != a.ShardRoot { t.Fatal("root mismatch") }

	store2, err := OpenFileStore(root)
	if err != nil { t.Fatal(err) }
	r2, err := NewRuntime("node-1", 1024, store2, chain, nil)
	if err != nil { t.Fatal(err) }
	if got := r2.Capacity().UsedBytes; got != uint64(len(data)) { t.Fatalf("restart used=%d", got) }
	all, _, err := r2.Retrieve(ctx, a.CommitmentID, 0, 0)
	if err != nil { t.Fatal(err) }
	if !bytes.Equal(all, data) { t.Fatal("restart payload mismatch") }
	if err := r2.Delete(ctx, a.CommitmentID); err != nil { t.Fatal(err) }
	if r2.Capacity().UsedBytes != 0 { t.Fatal("capacity not released") }
}

func TestStoreRejectsWrongRootAndCapacityOverflow(t *testing.T) {
	ctx := context.Background()
	data := []byte("abcdef")
	a := assignmentFor(data, "commitment-2", "node-1")
	bad := a
	bad.ShardRoot = "00"
	store, err := OpenFileStore(t.TempDir())
	if err != nil { t.Fatal(err) }
	r, err := NewRuntime("node-1", 1024, store, fakeChain{assignments: map[string]Assignment{bad.CommitmentID: bad}}, nil)
	if err != nil { t.Fatal(err) }
	if _, err := r.StoreShard(ctx, bad.CommitmentID, bytes.NewReader(data)); !errors.Is(err, ErrCommitmentMismatch) { t.Fatalf("got %v", err) }

	store2, err := OpenFileStore(t.TempDir())
	if err != nil { t.Fatal(err) }
	r2, err := NewRuntime("node-1", 3, store2, fakeChain{assignments: map[string]Assignment{a.CommitmentID: a}}, nil)
	if err != nil { t.Fatal(err) }
	if _, err := r2.StoreShard(ctx, a.CommitmentID, bytes.NewReader(data)); !errors.Is(err, ErrCapacityExceeded) { t.Fatalf("got %v", err) }
}

func TestProofBuildAndSubmitIsDeterministic(t *testing.T) {
	ctx := context.Background()
	data := []byte("proofable shard")
	a := assignmentFor(data, "commitment-3", "node-1")
	store, err := OpenFileStore(t.TempDir())
	if err != nil { t.Fatal(err) }
	sub := &fakeSubmitter{}
	r, err := NewRuntime("node-1", 1024, store, fakeChain{assignments: map[string]Assignment{a.CommitmentID: a}}, sub)
	if err != nil { t.Fatal(err) }
	if _, err := r.StoreShard(ctx, a.CommitmentID, bytes.NewReader(data)); err != nil { t.Fatal(err) }
	epoch := time.Unix(1_800_000_000, 0).UTC()
	ch := Challenge{AgreementID: a.AgreementID, CommitmentID: a.CommitmentID, ChallengeID: "challenge-1", Epoch: epoch}
	p1, err := r.BuildProof(ctx, ch)
	if err != nil { t.Fatal(err) }
	p2, err := r.Prove(ctx, ch)
	if err != nil { t.Fatal(err) }
	if p1.Digest != p2.Digest { t.Fatal("proof not deterministic") }
	if len(sub.proofs) != 1 || sub.proofs[0].Digest != p1.Digest { t.Fatal("proof not submitted") }
}

func TestInactiveOrForeignAssignmentFailsClosed(t *testing.T) {
	ctx := context.Background()
	data := []byte("abc")
	a := assignmentFor(data, "commitment-4", "other-node")
	store, err := OpenFileStore(t.TempDir())
	if err != nil { t.Fatal(err) }
	r, err := NewRuntime("node-1", 1024, store, fakeChain{assignments: map[string]Assignment{a.CommitmentID: a}}, nil)
	if err != nil { t.Fatal(err) }
	if _, err := r.StoreShard(ctx, a.CommitmentID, bytes.NewReader(data)); !errors.Is(err, ErrInactiveAssignment) { t.Fatalf("got %v", err) }
}
