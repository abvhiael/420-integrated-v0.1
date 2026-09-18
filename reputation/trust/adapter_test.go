package trust

import (
	"context"
	"encoding/hex"
	"errors"
	"math/big"
	"testing"

	"github.com/420integrated/420-integrated/reputation/model"
)

type fakeRPC struct {
	result string
	err    error
	method string
	params any
}

func (f *fakeRPC) Call(_ context.Context, method string, params any, result any) error {
	f.method = method
	f.params = params
	if f.err != nil {
		return f.err
	}
	*(result.(*string)) = f.result
	return nil
}

func bytes32(fill byte) [32]byte {
	var out [32]byte
	for i := range out { out[i] = fill }
	return out
}

func hex32(fill byte) string {
	b := bytes32(fill)
	return "0x" + hex.EncodeToString(b[:])
}

func metricResult(active bool, total int64, signals uint64) string {
	words := make([]byte, 0, 6*32)
	domain := bytes32(0x11)
	unit := bytes32(0x22)
	words = append(words, domain[:]...)
	words = append(words, unit[:]...)

	revision := make([]byte, 32)
	revision[31] = 3
	words = append(words, revision...)

	activeWord := make([]byte, 32)
	if active { activeWord[31] = 1 }
	words = append(words, activeWord...)

	totalWord := make([]byte, 32)
	n := big.NewInt(total)
	if total < 0 {
		n.Add(n, new(big.Int).Lsh(big.NewInt(1), 256))
	}
	raw := n.Bytes()
	copy(totalWord[32-len(raw):], raw)
	words = append(words, totalWord...)

	signalWord := make([]byte, 32)
	for i := 0; i < 8; i++ {
		signalWord[31-i] = byte(signals >> (8*i))
	}
	words = append(words, signalWord...)
	return "0x" + hex.EncodeToString(words)
}

func validConfig() Config {
	return Config{
		Aggregator: "0x1111111111111111111111111111111111111111",
		ReadMetricSelector: [4]byte{0xaa, 0xbb, 0xcc, 0xdd},
		SubjectTypes: map[string][32]byte{
			"PROFILE": bytes32(0x33),
			"SERVICE": bytes32(0x44),
		},
	}
}

func TestAdapterReadsExactMetric(t *testing.T) {
	rpc := &fakeRPC{result: metricResult(true, -7, 4)}
	adapter, err := NewAdapter(rpc, validConfig())
	if err != nil { t.Fatal(err) }

	got, err := adapter.ReadMetric(context.Background(), model.SubjectRef{
		Type: "PROFILE", ID: hex32(0x55),
	}, hex32(0x66))
	if err != nil { t.Fatal(err) }

	if rpc.method != "eth_call" {
		t.Fatalf("method=%q", rpc.method)
	}
	if got.DomainID != hex32(0x11) || got.UnitID != hex32(0x22) {
		t.Fatalf("metadata mismatch: %+v", got)
	}
	if got.MetricRevision != 3 || !got.Active || got.Total != "-7" || got.ActiveSignals != 4 {
		t.Fatalf("metric mismatch: %+v", got)
	}
}

func TestAdapterFailsClosedForInactiveMetric(t *testing.T) {
	adapter, err := NewAdapter(&fakeRPC{result: metricResult(false, 5, 1)}, validConfig())
	if err != nil { t.Fatal(err) }
	_, err = adapter.ReadMetric(context.Background(), model.SubjectRef{
		Type: "PROFILE", ID: hex32(0x55),
	}, hex32(0x66))
	if !errors.Is(err, ErrInactiveMetric) {
		t.Fatalf("expected inactive rejection, got %v", err)
	}
}

func TestAdapterRejectsUnmappedOrNonCanonicalIDs(t *testing.T) {
	adapter, err := NewAdapter(&fakeRPC{result: metricResult(true, 1, 1)}, validConfig())
	if err != nil { t.Fatal(err) }

	if _, err := adapter.ReadMetric(context.Background(), model.SubjectRef{
		Type: "PLACE", ID: hex32(0x55),
	}, hex32(0x66)); !errors.Is(err, ErrUnmappedSubject) {
		t.Fatalf("expected unmapped subject rejection, got %v", err)
	}

	if _, err := adapter.ReadMetric(context.Background(), model.SubjectRef{
		Type: "PROFILE", ID: "profile-1",
	}, hex32(0x66)); err == nil {
		t.Fatal("expected non-bytes32 subject id rejection")
	}

	if _, err := adapter.ReadMetric(context.Background(), model.SubjectRef{
		Type: "PROFILE", ID: hex32(0x55),
	}, "completed-transactions"); err == nil {
		t.Fatal("expected non-bytes32 metric id rejection")
	}
}

func TestAdapterRejectsMalformedTuple(t *testing.T) {
	adapter, err := NewAdapter(&fakeRPC{result: "0x1234"}, validConfig())
	if err != nil { t.Fatal(err) }
	_, err = adapter.ReadMetric(context.Background(), model.SubjectRef{
		Type: "PROFILE", ID: hex32(0x55),
	}, hex32(0x66))
	if !errors.Is(err, ErrMalformedData) {
		t.Fatalf("expected malformed data rejection, got %v", err)
	}
}

func TestAdapterPropagatesRPCFailure(t *testing.T) {
	want := errors.New("rpc unavailable")
	adapter, err := NewAdapter(&fakeRPC{err: want}, validConfig())
	if err != nil { t.Fatal(err) }
	_, err = adapter.ReadMetric(context.Background(), model.SubjectRef{
		Type: "PROFILE", ID: hex32(0x55),
	}, hex32(0x66))
	if !errors.Is(err, want) {
		t.Fatalf("expected rpc failure, got %v", err)
	}
}

func TestAdapterRequiresExplicitConfiguration(t *testing.T) {
	rpc := &fakeRPC{}
	if _, err := NewAdapter(nil, validConfig()); err == nil {
		t.Fatal("expected nil rpc rejection")
	}
	cfg := validConfig()
	cfg.Aggregator = "bad"
	if _, err := NewAdapter(rpc, cfg); err == nil {
		t.Fatal("expected bad aggregator rejection")
	}
	cfg = validConfig()
	cfg.ReadMetricSelector = [4]byte{}
	if _, err := NewAdapter(rpc, cfg); err == nil {
		t.Fatal("expected missing selector rejection")
	}
	cfg = validConfig()
	cfg.SubjectTypes = nil
	if _, err := NewAdapter(rpc, cfg); err == nil {
		t.Fatal("expected missing subject mapping rejection")
	}
}
