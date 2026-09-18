package userop

import (
	"encoding/hex"
	"strings"
	"testing"
)

func fixture() PackedUserOperation {
	return PackedUserOperation{
		Sender: "0x2222222222222222222222222222222222222222",
		Nonce: "0x5",
		InitCode: "0x",
		CallData: "0x1234",
		AccountGasLimits: "0x3333333333333333333333333333333333333333333333333333333333333333",
		PreVerificationGas: "0x5208",
		GasFees: "0x4444444444444444444444444444444444444444444444444444444444444444",
		PaymasterAndData: "0xdeadbeef",
		Signature: "0xaabbcc",
	}
}

func TestKeccak256KnownVector(t *testing.T) {
	sum := keccak256(nil)
	got := hex.EncodeToString(sum[:])
	const want = "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
	if got != want { t.Fatalf("keccak-256 empty mismatch: got %s want %s", got, want) }
}

func TestHashIsDeterministicAndSignatureIndependent(t *testing.T) {
	op := fixture()
	first, err := Hash(420, "0x1111111111111111111111111111111111111111", op)
	if err != nil { t.Fatal(err) }
	second, err := Hash(420, "0x1111111111111111111111111111111111111111", op)
	if err != nil { t.Fatal(err) }
	if first != second { t.Fatalf("hash is not deterministic: %s != %s", first, second) }
	if !strings.HasPrefix(first, "0x") || len(first) != 66 { t.Fatalf("unexpected hash format: %s", first) }

	op.Signature = "0xffff"
	changedSignature, err := Hash(420, "0x1111111111111111111111111111111111111111", op)
	if err != nil { t.Fatal(err) }
	if changedSignature != first { t.Fatal("signature changed canonical EntryPoint user operation hash") }
}

func TestHashBindsCanonicalFieldsChainAndEntryPoint(t *testing.T) {
	base := fixture()
	h0, err := Hash(420, "0x1111111111111111111111111111111111111111", base)
	if err != nil { t.Fatal(err) }

	cases := []struct{
		name string
		chain uint64
		entry string
		mutate func(*PackedUserOperation)
	}{
		{"chain", 421, "0x1111111111111111111111111111111111111111", func(*PackedUserOperation){}},
		{"entrypoint", 420, "0x1211111111111111111111111111111111111111", func(*PackedUserOperation){}},
		{"sender", 420, "0x1111111111111111111111111111111111111111", func(op *PackedUserOperation){ op.Sender="0x2322222222222222222222222222222222222222" }},
		{"nonce", 420, "0x1111111111111111111111111111111111111111", func(op *PackedUserOperation){ op.Nonce="0x6" }},
		{"initCode", 420, "0x1111111111111111111111111111111111111111", func(op *PackedUserOperation){ op.InitCode="0x01" }},
		{"callData", 420, "0x1111111111111111111111111111111111111111", func(op *PackedUserOperation){ op.CallData="0x1235" }},
		{"accountGasLimits", 420, "0x1111111111111111111111111111111111111111", func(op *PackedUserOperation){ op.AccountGasLimits="0x3433333333333333333333333333333333333333333333333333333333333333" }},
		{"preVerificationGas", 420, "0x1111111111111111111111111111111111111111", func(op *PackedUserOperation){ op.PreVerificationGas="0x5209" }},
		{"gasFees", 420, "0x1111111111111111111111111111111111111111", func(op *PackedUserOperation){ op.GasFees="0x4544444444444444444444444444444444444444444444444444444444444444" }},
		{"paymasterAndData", 420, "0x1111111111111111111111111111111111111111", func(op *PackedUserOperation){ op.PaymasterAndData="0xdeadbeee" }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			op := base
			tc.mutate(&op)
			got, err := Hash(tc.chain, tc.entry, op)
			if err != nil { t.Fatal(err) }
			if got == h0 { t.Fatalf("%s mutation did not change hash", tc.name) }
		})
	}
}

func TestCanonicalModelFailsClosed(t *testing.T) {
	cases := []struct{
		name string
		mutate func(*PackedUserOperation)
	}{
		{"zero-sender", func(op *PackedUserOperation){ op.Sender="0x0000000000000000000000000000000000000000" }},
		{"short-sender", func(op *PackedUserOperation){ op.Sender="0x12" }},
		{"noncanonical-nonce", func(op *PackedUserOperation){ op.Nonce="0x05" }},
		{"bad-nonce", func(op *PackedUserOperation){ op.Nonce="five" }},
		{"odd-init-code", func(op *PackedUserOperation){ op.InitCode="0x1" }},
		{"short-account-gas-limits", func(op *PackedUserOperation){ op.AccountGasLimits="0x00" }},
		{"short-gas-fees", func(op *PackedUserOperation){ op.GasFees="0x00" }},
		{"bad-signature", func(op *PackedUserOperation){ op.Signature="0xzz" }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			op:=fixture()
			tc.mutate(&op)
			if _,err:=op.Canonicalize(); err==nil { t.Fatal("expected canonicalization failure") }
		})
	}
}

func TestHashRejectsInvalidDomainBinding(t *testing.T) {
	op:=fixture()
	if _,err:=Hash(0,"0x1111111111111111111111111111111111111111",op); err==nil { t.Fatal("expected zero chain rejection") }
	if _,err:=Hash(420,"0x0000000000000000000000000000000000000000",op); err==nil { t.Fatal("expected zero entry point rejection") }
	if _,err:=Hash(420,"0x12",op); err==nil { t.Fatal("expected malformed entry point rejection") }
}
