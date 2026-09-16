package architecture

import "slices"

const (
	ServiceName = "420Verify"
	ServiceID   = "420/service/verify/v1"
	Phase       = "VERIFY-0"
)

type ResultClass string

const (
	ResultFullMatch    ResultClass = "FULL_MATCH"
	ResultPartialMatch ResultClass = "PARTIAL_MATCH"
	ResultMismatch     ResultClass = "MISMATCH"
	ResultUnverifiable ResultClass = "UNVERIFIABLE"
)

type CanonicalSource string

const (
	SourceChainState CanonicalSource = "canonical_chain_state"
	SourceRegistry   CanonicalSource = "420Registry"
)

type SecurityExclusion string

const (
	PrivateKeys          SecurityExclusion = "wallet_private_keys"
	SigningSecrets       SecurityExclusion = "signing_secrets"
	RegistryAuthority    SecurityExclusion = "registry_authority"
	WalletAuthority      SecurityExclusion = "wallet_authority"
	GovernanceAuthority  SecurityExclusion = "governance_authority"
)

type Profile struct {
	Service                         string
	ServiceID                       string
	Phase                           string
	ContractsRequired               bool
	CanonicalStateAuthority         bool
	VerificationDatabaseCanonical   bool
	AlternativeVerifiersAllowed     bool
	FullMatchRequiresRuntimeMatch   bool
	ResultsBoundToChainAddressCode  bool
	ProxyAndImplementationSeparate  bool
	VerificationImpliesAudit        bool
	VerificationImpliesSafety       bool
	VerificationImpliesOfficial     bool
	Sources                         []CanonicalSource
	ResultClasses                   []ResultClass
	SecurityExclusions              []SecurityExclusion
}

func GenesisProfile() Profile {
	return Profile{
		Service:                        ServiceName,
		ServiceID:                      ServiceID,
		Phase:                          Phase,
		ContractsRequired:              false,
		CanonicalStateAuthority:        false,
		VerificationDatabaseCanonical:  false,
		AlternativeVerifiersAllowed:    true,
		FullMatchRequiresRuntimeMatch:  true,
		ResultsBoundToChainAddressCode: true,
		ProxyAndImplementationSeparate: true,
		VerificationImpliesAudit:       false,
		VerificationImpliesSafety:      false,
		VerificationImpliesOfficial:    false,
		Sources: []CanonicalSource{
			SourceChainState,
			SourceRegistry,
		},
		ResultClasses: []ResultClass{
			ResultFullMatch,
			ResultPartialMatch,
			ResultMismatch,
			ResultUnverifiable,
		},
		SecurityExclusions: []SecurityExclusion{
			PrivateKeys,
			SigningSecrets,
			RegistryAuthority,
			WalletAuthority,
			GovernanceAuthority,
		},
	}
}

func (p Profile) AllowsSource(source CanonicalSource) bool {
	return slices.Contains(p.Sources, source)
}

func (p Profile) AllowsResultClass(class ResultClass) bool {
	return slices.Contains(p.ResultClasses, class)
}

func (p Profile) Excludes(class SecurityExclusion) bool {
	return slices.Contains(p.SecurityExclusions, class)
}
