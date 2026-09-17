package architecture

import "errors"

const (
	Phase     = "APPSTORE-0"
	ServiceID = "420/service/appstore/v1"
)

type FieldAuthority string

const (
	AuthorityCanonical    FieldAuthority = "CANONICAL"
	AuthorityNonCanonical FieldAuthority = "NON_CANONICAL"
)

type Boundary struct {
	ContractsRequired        bool
	CanonicalStateAuthority  bool
	RegistryAuthoritative    bool
	WalletAuthoritative      bool
	CatalogueRebuildable     bool
	AlternativeClients       bool
	PrivateContentIndexed    bool
	LaunchHistoryPublic      bool
}

func GenesisBoundary() Boundary {
	return Boundary{
		ContractsRequired:       false,
		CanonicalStateAuthority: false,
		RegistryAuthoritative:   true,
		WalletAuthoritative:     true,
		CatalogueRebuildable:    true,
		AlternativeClients:      true,
		PrivateContentIndexed:   false,
		LaunchHistoryPublic:     false,
	}
}

type ListingField struct {
	Name      string
	Authority FieldAuthority
}

func CanonicalFields() []ListingField {
	return []ListingField{
		{Name: "chainId", Authority: AuthorityCanonical},
		{Name: "network", Authority: AuthorityCanonical},
		{Name: "registryServiceId", Authority: AuthorityCanonical},
		{Name: "version", Authority: AuthorityCanonical},
		{Name: "implementation", Authority: AuthorityCanonical},
		{Name: "contractReferences", Authority: AuthorityCanonical},
	}
}

func PresentationFields() []ListingField {
	return []ListingField{
		{Name: "category", Authority: AuthorityNonCanonical},
		{Name: "ranking", Authority: AuthorityNonCanonical},
		{Name: "featured", Authority: AuthorityNonCanonical},
		{Name: "rating", Authority: AuthorityNonCanonical},
		{Name: "review", Authority: AuthorityNonCanonical},
		{Name: "description", Authority: AuthorityNonCanonical},
		{Name: "screenshots", Authority: AuthorityNonCanonical},
		{Name: "sponsoredPlacement", Authority: AuthorityNonCanonical},
	}
}

type LaunchContext struct {
	ChainID   uint64
	AppID     string
	Network   string
	CanSign   bool
	CanGrant  bool
	CanBypass bool
}

func (l LaunchContext) Validate() error {
	if l.ChainID == 0 || l.AppID == "" || l.Network == "" {
		return errors.New("launch context requires chain, application and network identity")
	}
	if l.CanSign || l.CanGrant || l.CanBypass {
		return errors.New("appstore launch context cannot inherit wallet authority")
	}
	return nil
}

var Invariants = []string{
	"APP-INV-001", "APP-INV-002", "APP-INV-003", "APP-INV-004", "APP-INV-005",
	"APP-INV-006", "APP-INV-007", "APP-INV-008", "APP-INV-009", "APP-INV-010",
	"APP-INV-011", "APP-INV-012", "APP-INV-013",
}
