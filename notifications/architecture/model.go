package architecture

import "errors"

const (
	Phase     = "NOTIFY-0"
	ServiceID = "420/service/notifications/v1"
)

type Boundary struct {
	ContractsRequired          bool
	CanonicalStateAuthority    bool
	IndexerPublicAPIOnly       bool
	ConsumerCheckpointPrivate  bool
	SubscriptionsPrivate       bool
	DeliveryEndpointsPrivate   bool
	PromotionalConsentSeparate bool
	WalletAuthoritative        bool
	AlternativeProviders       bool
	PrivatePayloadsIndexed     bool
}

func GenesisBoundary() Boundary {
	return Boundary{
		ContractsRequired:          false,
		CanonicalStateAuthority:    false,
		IndexerPublicAPIOnly:       true,
		ConsumerCheckpointPrivate:  true,
		SubscriptionsPrivate:       true,
		DeliveryEndpointsPrivate:   true,
		PromotionalConsentSeparate: true,
		WalletAuthoritative:        true,
		AlternativeProviders:       true,
		PrivatePayloadsIndexed:     false,
	}
}

type Canonicality string

const (
	CanonicalityFinalized  Canonicality = "finalized"
	CanonicalityRetracted  Canonicality = "retracted"
	CanonicalitySuperseded Canonicality = "superseded"
)

func ValidCanonicality(v Canonicality) bool {
	switch v {
	case CanonicalityFinalized, CanonicalityRetracted, CanonicalitySuperseded:
		return true
	default:
		return false
	}
}

type ActionContext struct {
	ChainID   uint64
	SourceID  string
	CanSign   bool
	CanSpend  bool
	CanGrant  bool
	CanBypass bool
}

func (a ActionContext) Validate() error {
	if a.ChainID == 0 || a.SourceID == "" {
		return errors.New("notification action requires chain and source identity")
	}
	if a.CanSign || a.CanSpend || a.CanGrant || a.CanBypass {
		return errors.New("notification action cannot inherit wallet authority")
	}
	return nil
}

type ReplayCheckpoint struct {
	ChainID uint64
	Cursor  string
}

func (c ReplayCheckpoint) Validate() error {
	if c.ChainID == 0 || c.Cursor == "" {
		return errors.New("notification replay checkpoint requires chain and opaque cursor")
	}
	return nil
}

var Invariants = []string{
	"NOTIFY-INV-001", "NOTIFY-INV-002", "NOTIFY-INV-003", "NOTIFY-INV-004", "NOTIFY-INV-005",
	"NOTIFY-INV-006", "NOTIFY-INV-007", "NOTIFY-INV-008", "NOTIFY-INV-009", "NOTIFY-INV-010",
	"NOTIFY-INV-011", "NOTIFY-INV-012", "NOTIFY-INV-013", "NOTIFY-INV-014",
}
