//go:build blst
// +build blst

package bls

import (
	ctypes "github.com/420integrated/420-integrated/consensus/types"
	blst "github.com/supranational/blst/bindings/go"
)

var popDST = []byte("BLS_POP_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_420_INTEGRATED_V1")

func (s *SecretKey) ProofOfPossession(pk ctypes.BLSPubkey) (ctypes.BLSSignature, error) {
	if s == nil || s.sk == nil {
		return ctypes.BLSSignature{}, ErrInvalidSecretKey
	}
	sig := new(blst.P2Affine).Sign(s.sk, pk[:], popDST)
	var out ctypes.BLSSignature
	copy(out[:], sig.Compress())
	return out, nil
}

func VerifyProofOfPossession(pk ctypes.BLSPubkey, proof ctypes.BLSSignature) bool {
	p, err := decodePK(pk)
	if err != nil {
		return false
	}
	s, err := decodeSig(proof)
	if err != nil {
		return false
	}
	return s.Verify(true, p, true, pk[:], popDST)
}
