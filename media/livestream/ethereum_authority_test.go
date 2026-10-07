package livestream

import (
	"context"
	"encoding/hex"
	"errors"
	"testing"
)

type rpcFake struct {
	result string
	err    error
	method string
	params any
}

func (f *rpcFake) Call(_ context.Context, method string, params any, result any) error {
	f.method = method
	f.params = params
	if f.err != nil {
		return f.err
	}
	ptr := result.(*string)
	*ptr = f.result
	return nil
}

func encodeStreamState(controller string, state, exists uint64) string {
	words := make([]byte, 8*32)
	address, _ := hex.DecodeString(controller[2:])
	copy(words[12:32], address)
	words[6*32+31] = byte(state)
	words[7*32+31] = byte(exists)
	return "0x" + hex.EncodeToString(words)
}

func TestEthereumStreamAuthorityReadsCanonicalControllerAndRetirement(t *testing.T) {
	rpc := &rpcFake{result: encodeStreamState("0x1111111111111111111111111111111111111111", 2, 1)}
	a, err := NewEthereumStreamAuthority(rpc, "0x2222222222222222222222222222222222222222", "0x12345678")
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := a.Snapshot(context.Background(), streamRef(1))
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Controller != "0x1111111111111111111111111111111111111111" || snapshot.Retired {
		t.Fatalf("snapshot=%+v", snapshot)
	}
	rpc.result = encodeStreamState("0x1111111111111111111111111111111111111111", 4, 1)
	snapshot, err = a.Snapshot(context.Background(), streamRef(1))
	if err != nil || !snapshot.Retired {
		t.Fatalf("retired snapshot=%+v err=%v", snapshot, err)
	}
	if rpc.method != "eth_call" {
		t.Fatalf("method=%q", rpc.method)
	}
}

func TestEthereumStreamAuthorityFailsClosedOnMissingMalformedOrRPCFailure(t *testing.T) {
	rpc := &rpcFake{}
	a, _ := NewEthereumStreamAuthority(rpc, "0x2222222222222222222222222222222222222222", "0x12345678")
	for _, raw := range []string{
		"0x",
		encodeStreamState("0x1111111111111111111111111111111111111111", 0, 1),
		encodeStreamState("0x1111111111111111111111111111111111111111", 2, 0),
	} {
		rpc.result = raw
		if _, err := a.Snapshot(context.Background(), streamRef(1)); !errors.Is(err, ErrMalformedStreamState) {
			t.Fatalf("raw=%q err=%v", raw, err)
		}
	}
	rpc.err = errors.New("rpc unavailable")
	if _, err := a.Snapshot(context.Background(), streamRef(1)); err == nil {
		t.Fatal("expected rpc failure")
	}
}
