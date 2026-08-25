//go:build blst
// +build blst

package bls

import (
	"crypto/rand"
	"errors"
	"fmt"

	blst "github.com/supranational/blst/bindings/go"

	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

// Minimal-pubkey-size mode: public keys are G1 (48 bytes), signatures are G2 (96 bytes).
var dst = []byte("BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_420_INTEGRATED_V1")

type SecretKey struct {
	sk *blst.SecretKey
}

func Generate() (*SecretKey, ctypes.BLSPubkey, error) {
	ikm := make([]byte, 32)
	if _, err := rand.Read(ikm); err != nil {
		return nil, ctypes.BLSPubkey{}, err
	}
	sk := blst.KeyGen(ikm)
	if sk == nil {
		return nil, ctypes.BLSPubkey{}, ErrInvalidSecretKey
	}
	pk := new(blst.P1Affine).From(sk)
	var out ctypes.BLSPubkey
	copy(out[:], pk.Compress())
	return &SecretKey{sk: sk}, out, nil
}

func SecretFromIKM(ikm []byte) (*SecretKey, ctypes.BLSPubkey, error) {
	if len(ikm) < 32 {
		return nil, ctypes.BLSPubkey{}, fmt.Errorf("ikm must be at least 32 bytes")
	}
	sk := blst.KeyGen(ikm)
	if sk == nil {
		return nil, ctypes.BLSPubkey{}, ErrInvalidSecretKey
	}
	pk := new(blst.P1Affine).From(sk)
	var out ctypes.BLSPubkey
	copy(out[:], pk.Compress())
	return &SecretKey{sk: sk}, out, nil
}

func (s *SecretKey) Sign(message []byte) (ctypes.BLSSignature, error) {
	if s == nil || s.sk == nil {
		return ctypes.BLSSignature{}, ErrInvalidSecretKey
	}
	sig := new(blst.P2Affine).Sign(s.sk, message, dst)
	var out ctypes.BLSSignature
	copy(out[:], sig.Compress())
	return out, nil
}

func decodePK(pk ctypes.BLSPubkey) (*blst.P1Affine, error) {
	p := new(blst.P1Affine).Uncompress(pk[:])
	if p == nil || !p.KeyValidate() {
		return nil, ErrInvalidPublicKey
	}
	return p, nil
}

func decodeSig(sig ctypes.BLSSignature) (*blst.P2Affine, error) {
	s := new(blst.P2Affine).Uncompress(sig[:])
	if s == nil || !s.SigValidate(false) {
		return nil, ErrInvalidSignature
	}
	return s, nil
}

func Verify(pk ctypes.BLSPubkey, message []byte, sig ctypes.BLSSignature) bool {
	p, err := decodePK(pk)
	if err != nil {
		return false
	}
	s, err := decodeSig(sig)
	if err != nil {
		return false
	}
	return s.Verify(true, p, true, message, dst)
}

func Aggregate(signatures []ctypes.BLSSignature) (ctypes.BLSSignature, error) {
	if len(signatures) == 0 {
		return ctypes.BLSSignature{}, errors.New("no signatures")
	}
	agg := new(blst.P2Aggregate)
	for i, raw := range signatures {
		s, err := decodeSig(raw)
		if err != nil {
			return ctypes.BLSSignature{}, fmt.Errorf("signature %d: %w", i, err)
		}
		if !agg.Add(s, false) {
			return ctypes.BLSSignature{}, fmt.Errorf("aggregate add failed at %d", i)
		}
	}
	outAffine := agg.ToAffine()
	var out ctypes.BLSSignature
	copy(out[:], outAffine.Compress())
	return out, nil
}

func FastAggregateVerify(pubkeys []ctypes.BLSPubkey, message []byte, signature ctypes.BLSSignature) bool {
	if len(pubkeys) == 0 {
		return false
	}
	pks := make([]*blst.P1Affine, 0, len(pubkeys))
	for _, raw := range pubkeys {
		p, err := decodePK(raw)
		if err != nil {
			return false
		}
		pks = append(pks, p)
	}
	sig, err := decodeSig(signature)
	if err != nil {
		return false
	}
	return sig.FastAggregateVerify(true, pks, message, dst)
}
