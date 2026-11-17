//go:build !blst

package recovery

import "github.com/420integrated/420-integrated/consensus/crypto/bls"

func ProductionSignatures() (Signatures, error) { return nil, bls.ErrBackendUnavailable }
