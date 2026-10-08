package reeferreview

import (
	"context"
	"errors"
	"strings"
	"time"
)

const RightsServiceID = "420/service/rights/v1"

var ErrRightsProvenance = errors.New("reefer review: invalid 420 Rights provenance")

type RightsAssertionRequest struct {
	Actor         string
	Wallet        string
	PublicationID string
	BodyDigest    string
}

type RightsProvenance struct {
	ServiceID      string    `json:"service_id"`
	SubjectID      string    `json:"subject_id"`
	RightID        string    `json:"right_id"`
	ClaimID        string    `json:"claim_id"`
	HolderWallet   string    `json:"holder_wallet"`
	EvidenceHash   string    `json:"evidence_hash"`
	ProvenanceHash string    `json:"provenance_hash"`
	BodyDigest     string    `json:"body_digest"`
	ChainID        uint64    `json:"chain_id"`
	Network        string    `json:"network"`
	RegistryRef    string    `json:"registry_ref"`
	RouterRef      string    `json:"router_ref"`
	BlockNumber    uint64    `json:"block_number"`
	BlockHash      string    `json:"block_hash"`
	VerifiedAt     time.Time `json:"verified_at"`
}

type RightsProvenanceProvider interface {
	AssertProvenance(context.Context, RightsAssertionRequest) (RightsProvenance, error)
}

func validateRightsProvenance(ctx context.Context, actor, publicationID, digest string, rights Rights) (RightsProvenance, error) {
	provider, ok := rights.(RightsProvenanceProvider)
	if !ok {
		return RightsProvenance{}, ErrRightsProvenance
	}
	wallet := ""
	expectedChain := uint64(0)
	expectedNetwork := ""
	if claims, ok := authenticatedSession(ctx); ok {
		wallet = claims.Wallet
		expectedChain = claims.ChainID
		expectedNetwork = claims.Network
	}
	evidence, err := provider.AssertProvenance(ctx, RightsAssertionRequest{
		Actor: actor, Wallet: wallet, PublicationID: publicationID, BodyDigest: digest,
	})
	if err != nil {
		return RightsProvenance{}, err
	}
	if evidence.ServiceID != RightsServiceID ||
		strings.TrimSpace(evidence.SubjectID) == "" ||
		strings.TrimSpace(evidence.RightID) == "" ||
		strings.TrimSpace(evidence.ClaimID) == "" ||
		!validWalletAddress(evidence.HolderWallet) ||
		strings.TrimSpace(evidence.EvidenceHash) == "" ||
		strings.TrimSpace(evidence.ProvenanceHash) == "" ||
		!strings.EqualFold(strings.TrimSpace(evidence.BodyDigest), strings.TrimSpace(digest)) ||
		evidence.ChainID == 0 ||
		strings.TrimSpace(evidence.Network) == "" ||
		strings.TrimSpace(evidence.RegistryRef) == "" ||
		strings.TrimSpace(evidence.RouterRef) == "" ||
		evidence.BlockNumber == 0 ||
		strings.TrimSpace(evidence.BlockHash) == "" ||
		evidence.VerifiedAt.IsZero() {
		return RightsProvenance{}, ErrRightsProvenance
	}
	if wallet != "" && !strings.EqualFold(wallet, evidence.HolderWallet) {
		return RightsProvenance{}, ErrRightsProvenance
	}
	if expectedChain != 0 && evidence.ChainID != expectedChain {
		return RightsProvenance{}, ErrRightsProvenance
	}
	if expectedNetwork != "" && evidence.Network != expectedNetwork {
		return RightsProvenance{}, ErrRightsProvenance
	}
	return evidence, nil
}
