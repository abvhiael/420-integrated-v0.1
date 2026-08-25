//go:build blst
// +build blst

package bls

import ctypes "github.com/420integrated/420-integrated/consensus/types"

func (ProductionVerifier) VerifyAggregate(pubkeys []ctypes.BLSPubkey, message []byte, signature ctypes.BLSSignature) bool {
	return FastAggregateVerify(pubkeys, message, signature)
}
