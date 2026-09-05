package discovery

import (
	"context"
	"encoding/hex"
	"errors"
	"testing"
)

type fakeRPC struct {
	calls []string
	fn    func(method string, params any, result any) error
}

func (f *fakeRPC) Call(_ context.Context, method string, params any, result any) error {
	f.calls = append(f.calls, method)
	return f.fn(method, params, result)
}

func wordUint(v uint64) [32]byte {
	var w [32]byte
	for i := 31; i >= 24; i-- { w[i] = byte(v); v >>= 8 }
	return w
}

func encodeWords(words ...[32]byte) string {
	b := make([]byte, 0, len(words)*32)
	for _, w := range words { b = append(b, w[:]...) }
	return "0x" + hex.EncodeToString(b)
}

func config(rpc *fakeRPC) EthereumConfig {
	return EthereumConfig{
		RPC: rpc,
		RegistryAddress: "0x1111111111111111111111111111111111111111",
		CapabilityChangedTopic: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		OperatorsSelector: "0x12345678",
		OperationalSelector: "0x87654321",
		FromBlock: 7,
	}
}

func TestEthereumIndexReconstructsLatestCapabilityState(t *testing.T) {
	capID := id32(2)
	opA := id32(1)
	opB := id32(3)
	rpc := &fakeRPC{fn: func(method string, _ any, result any) error {
		if method != "eth_getLogs" { t.Fatalf("method=%s", method) }
		logs := result.(*[]rpcLog)
		*logs = []rpcLog{
			{BlockNumber:"0x8", LogIndex:"0x1", Topics:[]string{config(nil).CapabilityChangedTopic, hex32(opA), hex32(capID)}, Data:encodeWords(wordUint(1))},
			{BlockNumber:"0x9", LogIndex:"0x0", Topics:[]string{config(nil).CapabilityChangedTopic, hex32(opA), hex32(capID)}, Data:encodeWords(wordUint(0))},
			{BlockNumber:"0x8", LogIndex:"0x2", Topics:[]string{config(nil).CapabilityChangedTopic, hex32(opB), hex32(capID)}, Data:encodeWords(wordUint(1))},
		}
		return nil
	}}
	cfg := config(rpc)
	d, err := NewEthereumDiscovery(cfg)
	if err != nil { t.Fatal(err) }
	ids, err := d.OperatorIDs(context.Background(), capID)
	if err != nil { t.Fatal(err) }
	if len(ids) != 1 || ids[0] != opB { t.Fatalf("ids=%v", ids) }
}

func TestEthereumIndexRejectsRemovedOrMalformedLogs(t *testing.T) {
	capID := id32(2)
	opID := id32(1)
	rpc := &fakeRPC{fn: func(_ string, _ any, result any) error {
		logs := result.(*[]rpcLog)
		*logs = []rpcLog{{BlockNumber:"0x8", LogIndex:"0x0", Removed:true, Topics:[]string{config(nil).CapabilityChangedTopic, hex32(opID), hex32(capID)}, Data:encodeWords(wordUint(1))}}
		return nil
	}}
	d, _ := NewEthereumDiscovery(config(rpc))
	if _, err := d.OperatorIDs(context.Background(), capID); !errors.Is(err, ErrMalformedChainData) { t.Fatalf("err=%v", err) }
}

func TestCanonicalProviderReadsRegistryAndOperationalState(t *testing.T) {
	opID := id32(1)
	capID := id32(2)
	meta := id32(9)
	count := 0
	rpc := &fakeRPC{fn: func(method string, _ any, result any) error {
		if method != "eth_call" { t.Fatalf("method=%s", method) }
		count++
		out := result.(*string)
		if count == 1 {
			var addr1, addr2 [32]byte
			addr1[31], addr2[31] = 1, 2
			*out = encodeWords(addr1, addr2, meta, id32(4), id32(5), wordUint(100), wordUint(7), wordUint(2), wordUint(1))
		} else {
			*out = encodeWords(wordUint(1))
		}
		return nil
	}}
	d, _ := NewEthereumDiscovery(config(rpc))
	p, err := d.CanonicalProvider(context.Background(), opID, capID)
	if err != nil { t.Fatal(err) }
	if !p.Active || p.OperatorID != opID || p.MetadataHash != meta || p.Revision != 7 || !p.Supports(capID) { t.Fatalf("provider=%+v", p) }
}

func TestCanonicalProviderFailsClosedOnMalformedABI(t *testing.T) {
	rpc := &fakeRPC{fn: func(_ string, _ any, result any) error {
		*(result.(*string)) = "0x01"
		return nil
	}}
	d, _ := NewEthereumDiscovery(config(rpc))
	if _, err := d.CanonicalProvider(context.Background(), id32(1), id32(2)); !errors.Is(err, ErrMalformedChainData) { t.Fatalf("err=%v", err) }
}

func TestCanonicalProviderPropagatesRPCFailure(t *testing.T) {
	boom := errors.New("rpc down")
	rpc := &fakeRPC{fn: func(_ string, _ any, _ any) error { return boom }}
	d, _ := NewEthereumDiscovery(config(rpc))
	if _, err := d.CanonicalProvider(context.Background(), id32(1), id32(2)); !errors.Is(err, boom) { t.Fatalf("err=%v", err) }
}

func TestNewEthereumDiscoveryRejectsInvalidConfig(t *testing.T) {
	if _, err := NewEthereumDiscovery(EthereumConfig{}); !errors.Is(err, ErrInvalidRequest) { t.Fatalf("err=%v", err) }
}

func id32(b byte) [32]byte { var v [32]byte; v[31] = b; return v }
func hex32(v [32]byte) string { return "0x" + hex.EncodeToString(v[:]) }
