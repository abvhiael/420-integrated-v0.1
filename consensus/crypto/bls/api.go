package bls

import (
	"errors"

	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

var (
	ErrInvalidSecretKey   = errors.New("invalid BLS secret key")
	ErrInvalidPublicKey   = errors.New("invalid BLS public key")
	ErrInvalidSignature   = errors.New("invalid BLS signature")
	ErrBackendUnavailable = errors.New("BLS backend not compiled; build with -tags blst after adding github.com/supranational/blst")
)

type Verifier interface {
	VerifyAggregate(pubkeys []ctypes.BLSPubkey, message []byte, signature ctypes.BLSSignature) bool
}

// ProductionVerifier is implemented in backend_blst.go when built with the blst tag.
// The default offline build deliberately returns unavailable rather than substituting
// non-cryptographic consensus signatures.
type ProductionVerifier struct{}

}
