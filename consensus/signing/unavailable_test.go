//go:build !blst

package signing

import (
	"errors"
	"github.com/420integrated/420-integrated/consensus/crypto/bls"
	"testing"
)

func TestNoProductionSigningFallback(t *testing.T) {
	if _, err := NewSigner(Policy{}, nil, nil, nil); !errors.Is(err, bls.ErrBackendUnavailable) {
		t.Fatal(err)
	}
	if _, err := NewClient("https://localhost", nil, Policy{}, nil); !errors.Is(err, bls.ErrBackendUnavailable) {
		t.Fatal(err)
	}
}
