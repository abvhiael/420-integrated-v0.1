//go:build blst

package recovery

import (
	"github.com/420integrated/420-integrated/consensus/crypto/bls"
	ct "github.com/420integrated/420-integrated/consensus/types"
)

type productionSignatures struct{ bls.ProductionVerifier }

func (productionSignatures) VerifyProof(pk ct.BLSPubkey, p ct.BLSSignature) bool {
	return bls.VerifyProofOfPossession(pk, p)
}
func ProductionSignatures() (Signatures, error) { return productionSignatures{}, nil }
