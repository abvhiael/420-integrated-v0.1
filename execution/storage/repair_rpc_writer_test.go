package storage

import (
	"bytes"
	"testing"
)

var _ RepairLifecycleWriter = RPCRepairLifecycleWriter{}

func TestRepairRPCDeterministicIDs(t *testing.T) {
	intent := RepairExecutionIntent{
		ManifestID: "0x" + repeatHexByte("11", 32),
		Shard: RepairShardRef{ShardIndex: 7},
		Candidate: RepairProviderCandidate{NodeID: "0x" + repeatHexByte("22", 32)},
	}
	n1 := repairNonce(intent)
	n2 := repairNonce(intent)
	if n1 != n2 || n1 == ([32]byte{}) { t.Fatal("repair nonce not deterministic") }
	c := repairCommitmentID(intent)
	if c == ([32]byte{}) || c == n1 { t.Fatal("commitment domain collision") }
	m := repairMetadataID(intent)
	if m == ([32]byte{}) || m == c || m == n1 { t.Fatal("metadata domain collision") }
}

func TestFixedCalldataUsesCanonicalSelectorAndWords(t *testing.T) {
	a := uintWord(7)
	b := uintWord(42)
	got := fixedCalldata("f(uint256,uint256)", a, b)
	if len(got) != 68 { t.Fatalf("length=%d", len(got)) }
	sig := keccak256([]byte("f(uint256,uint256)"))
	if !bytes.Equal(got[:4], sig[:4]) { t.Fatal("selector") }
	if !bytes.Equal(got[4:36], a[:]) || !bytes.Equal(got[36:68], b[:]) { t.Fatal("abi words") }
}

func TestAddressWordRightAlignsAddress(t *testing.T) {
	w := addressWord("0x1111111111111111111111111111111111111111")
	for i := 0; i < 12; i++ { if w[i] != 0 { t.Fatal("address not right aligned") } }
	for i := 12; i < 32; i++ { if w[i] != 0x11 { t.Fatal("address bytes") } }
}

func repeatHexByte(v string, n int) string {
	out := ""
	for i := 0; i < n; i++ { out += v }
	return out
}
