//go:build blst
// +build blst

package bls

import (
	types "github.com/420integrated/420-integrated/consensus/types"
	"testing"
)

func TestSignVerifyAggregateAndPoP(t *testing.T) {
	msg := []byte("420-integrated-step4.3")
	var sigs = make([]types.BLSSignature, 0, 3)
	var pks = make([]types.BLSPubkey, 0, 3)

	for i := 0; i < 3; i++ {
		ikm := make([]byte, 32)
		for j := range ikm {
			ikm[j] = byte(i + j + 1)
		}
		sk, pk, err := SecretFromIKM(ikm)
		if err != nil {
			t.Fatal(err)
		}
		pop, err := sk.ProofOfPossession(pk)
		if err != nil || !VerifyProofOfPossession(pk, pop) {
			t.Fatal("proof of possession failed")
		}
		sig, err := sk.Sign(msg)
		if err != nil || !Verify(pk, msg, sig) {
			t.Fatal("signature failed")
		}
		sigs = append(sigs, sig)
		pks = append(pks, pk)
	}
	agg, err := Aggregate(sigs)
	if err != nil {
		t.Fatal(err)
	}
	if !FastAggregateVerify(pks, msg, agg) {
		t.Fatal("aggregate verification failed")
	}
}
