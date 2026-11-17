//go:build !blst

package signing

import (
	"context"
	"github.com/420integrated/420-integrated/consensus/crypto/bls"
	"github.com/420integrated/420-integrated/consensus/slashing"
)

type Signer struct{}

func NewSigner(Policy, []byte, *slashing.Protector, *Witness) (*Signer, error) {
	return nil, bls.ErrBackendUnavailable
}
func (*Signer) Sign(context.Context, Duty) (Result, error) {
	return Result{}, bls.ErrBackendUnavailable
}
func verifyResult(Policy, Duty, Result) error { return bls.ErrBackendUnavailable }

func backendReady() error              { return bls.ErrBackendUnavailable }
func ValidateKey(Policy, []byte) error { return bls.ErrBackendUnavailable }
func (*Signer) Close()                 {}

func (*Signer) Health(context.Context) error { return bls.ErrBackendUnavailable }
