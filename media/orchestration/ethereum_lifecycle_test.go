package orchestration

import (
	"context"
	"encoding/hex"
	"errors"
	"testing"
	"time"
)

type lifecycleRPC struct { responses []string; err error; calls int }
func (r *lifecycleRPC) Call(_ context.Context, _ string, _ any, result any) error {
	if r.err != nil { return r.err }
	p, ok := result.(*string); if !ok { return errors.New("unexpected result type") }
	if r.calls >= len(r.responses) { return errors.New("missing response") }
	*p = r.responses[r.calls]; r.calls++; return nil
}

type lifecycleSigner struct { to string; data []byte; err error }
func (s *lifecycleSigner) SendTransaction(_ context.Context, to string, data []byte) (string, error) {
	if s.err != nil { return "", s.err }
	s.to = to; s.data = append([]byte(nil), data...); return "0x01", nil
}

func TestEthereumLifecycleCreateAssignedJob(t *testing.T) {
	rpc := &lifecycleRPC{}
	signer := &lifecycleSigner{}
	m, err := NewEthereumLifecycleMarket(EthereumLifecycleConfig{RPC: rpc, Signer: signer, MarketAddress: "0x1111111111111111111111111111111111111111", JobsSelector: [4]byte{1}, ReservedOperatorSelector: [4]byte{2}, CreateAssignedSelector: [4]byte{3}})
	if err != nil { t.Fatal(err) }
	spec := JobSpec{JobID: b32(1), StreamID: b32(2), JobKind: b32(3), CapabilityID: b32(4), InputRef: b32(5), OperatorID: b32(6), MaxSpend: 420, Deadline: time.Unix(2_000_000_000, 0)}
	if err := m.CreateJob(context.Background(), spec); err != nil { t.Fatal(err) }
	if len(signer.data) != 4+9*32 { t.Fatalf("calldata len=%d", len(signer.data)) }
	if signer.data[0] != 3 { t.Fatalf("selector=%x", signer.data[:4]) }
	if got := signer.data[len(signer.data)-32:]; hex.EncodeToString(got) != hex.EncodeToString(spec.OperatorID[:]) { t.Fatal("operator reservation not encoded") }
}

func TestEthereumLifecycleSnapshotUsesReservationBeforeAcceptance(t *testing.T) {
	job := make([]byte, 13*32)
	copy(job[6*32:7*32], b32(9)[:])
	copy(job[12*32:13*32], uintWord(1))
	reserved := b32(7)
	rpc := &lifecycleRPC{responses: []string{"0x"+hex.EncodeToString(job), "0x"+hex.EncodeToString(reserved[:])}}
	m, err := NewEthereumLifecycleMarket(EthereumLifecycleConfig{RPC: rpc, Signer: &lifecycleSigner{}, MarketAddress: "0x1111111111111111111111111111111111111111", JobsSelector: [4]byte{1}, ReservedOperatorSelector: [4]byte{2}, CreateAssignedSelector: [4]byte{3}})
	if err != nil { t.Fatal(err) }
	snap, err := m.Snapshot(context.Background(), b32(1)); if err != nil { t.Fatal(err) }
	if snap.Status != LifecycleCreated || snap.OperatorID != reserved || snap.OutputRef != b32(9) { t.Fatalf("snapshot=%+v", snap) }
}

func TestEthereumLifecycleSnapshotUsesAcceptedOperator(t *testing.T) {
	job := make([]byte, 13*32)
	op := b32(7); copy(job[7*32:8*32], op[:]); copy(job[12*32:13*32], uintWord(2))
	rpc := &lifecycleRPC{responses: []string{"0x"+hex.EncodeToString(job)}}
	m, _ := NewEthereumLifecycleMarket(EthereumLifecycleConfig{RPC: rpc, Signer: &lifecycleSigner{}, MarketAddress: "0x1111111111111111111111111111111111111111", JobsSelector: [4]byte{1}, ReservedOperatorSelector: [4]byte{2}, CreateAssignedSelector: [4]byte{3}})
	snap, err := m.Snapshot(context.Background(), b32(1)); if err != nil { t.Fatal(err) }
	if snap.OperatorID != op || snap.Status != LifecycleAccepted || rpc.calls != 1 { t.Fatalf("snapshot=%+v calls=%d", snap, rpc.calls) }
}

func TestEthereumLifecycleSnapshotNotFound(t *testing.T) {
	rpc := &lifecycleRPC{responses: []string{"0x"+hex.EncodeToString(make([]byte, 13*32))}}
	m, _ := NewEthereumLifecycleMarket(EthereumLifecycleConfig{RPC: rpc, Signer: &lifecycleSigner{}, MarketAddress: "0x1111111111111111111111111111111111111111", JobsSelector: [4]byte{1}, ReservedOperatorSelector: [4]byte{2}, CreateAssignedSelector: [4]byte{3}})
	_, err := m.Snapshot(context.Background(), b32(1))
	if !errors.Is(err, ErrLifecycleJobNotFound) { t.Fatalf("err=%v", err) }
}

func TestEthereumLifecycleFailsClosedOnMalformedChainData(t *testing.T) {
	rpc := &lifecycleRPC{responses: []string{"0x01"}}
	m, _ := NewEthereumLifecycleMarket(EthereumLifecycleConfig{RPC: rpc, Signer: &lifecycleSigner{}, MarketAddress: "0x1111111111111111111111111111111111111111", JobsSelector: [4]byte{1}, ReservedOperatorSelector: [4]byte{2}, CreateAssignedSelector: [4]byte{3}})
	_, err := m.Snapshot(context.Background(), b32(1))
	if !errors.Is(err, ErrMalformedLifecycleChainData) { t.Fatalf("err=%v", err) }
}
