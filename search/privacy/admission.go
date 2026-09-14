package privacy

import (
	"errors"
	"fmt"
	"strings"

	"github.com/420integrated/420-integrated/search/architecture"
)

const AdmissionVersion = "420-search-privacy-admission-v1"

type Classification string

const (
	ClassPublicOnChain          Classification = "public_onchain"
	ClassPrivateMessenger       Classification = "private_messenger"
	ClassPrivateCommons         Classification = "private_commons"
	ClassPrivateIdentity        Classification = "private_identity"
	ClassEncryptedResource      Classification = "encrypted_resource_payload"
	ClassRawAttentionTelemetry  Classification = "raw_attention_telemetry"
)

type Candidate struct {
	Source         architecture.SourceBoundary
	Domain         architecture.ResultDomain
	Classification Classification
	Public         bool
}

var allowedSourceDomains = map[architecture.SourceBoundary]map[architecture.ResultDomain]struct{}{
	architecture.SourceIndexer: {
		architecture.DomainBlock: {}, architecture.DomainTransaction: {}, architecture.DomainAddress: {}, architecture.DomainContract: {},
	},
	architecture.SourceRegistry: {architecture.DomainService: {}},
	architecture.SourceNames: {architecture.DomainName: {}},
	architecture.SourceIdentity: {architecture.DomainPublicIdentity: {}},
	architecture.SourceMarket: {architecture.DomainMarketListing: {}},
	architecture.SourceRights: {architecture.DomainRightsRecord: {}},
	architecture.SourceCommons: {architecture.DomainPublicCommons: {}},
	architecture.SourcePulse: {architecture.DomainPublicPulse: {}},
}

// Admit is the Search source-admission boundary for privacy-sensitive material.
// Anything not explicitly public and mapped to a frozen public source/domain pair
// is rejected. Private/encrypted classifications fail closed even if a caller
// accidentally marks the record Public.
func Admit(candidate Candidate) error {
	if candidate.Classification == "" {
		return errors.New("privacy classification required")
	}
	switch candidate.Classification {
	case ClassPrivateMessenger, ClassPrivateCommons, ClassPrivateIdentity, ClassEncryptedResource, ClassRawAttentionTelemetry:
		return fmt.Errorf("search privacy exclusion: %s", candidate.Classification)
	case ClassPublicOnChain:
	default:
		return errors.New("unsupported privacy classification")
	}
	if !candidate.Public {
		return errors.New("search source is not explicitly public")
	}
	if strings.Contains(strings.ToLower(string(candidate.Source)), ":private") {
		return errors.New("private source boundary is not admissible")
	}
	domains, ok := allowedSourceDomains[candidate.Source]
	if !ok {
		return errors.New("search source boundary is not admitted")
	}
	if _, ok := domains[candidate.Domain]; !ok {
		return errors.New("search source/domain pair is not admitted")
	}
	return nil
}
