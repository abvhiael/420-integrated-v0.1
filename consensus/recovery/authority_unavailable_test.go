//go:build !blst

package recovery

import (
	"errors"
	"github.com/420integrated/420-integrated/consensus/crypto/bls"
	"testing"
)

func TestProductionAuthorityNeverFallsBack(t *testing.T) {
	s, e := ProductionSignatures()
	if s != nil || !errors.Is(e, bls.ErrBackendUnavailable) {
		t.Fatalf("unavailable production BLS accepted: %v %v", s, e)
	}
}
