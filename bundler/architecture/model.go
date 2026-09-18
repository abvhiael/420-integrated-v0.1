package architecture

import "errors"

const (
	Phase     = "GEN-11.0"
	ServiceID = "420/service/bundler/v1"
)

type Boundary struct {
	ContractsRequired          bool
	Custodial                  bool
	AuthorizationAuthority     bool
	FinalityAuthority          bool
	EntryPointAuthoritative    bool
	LocalValidationRequired    bool
	AlternativeBundlersAllowed bool
	PaymasterNeutral           bool
	StatusNonCanonical         bool
	PrivateKeysStored          bool
	PeerBypassesValidation     bool
}

func GenesisBoundary() Boundary {
	return Boundary{
		ContractsRequired:          false,
		Custodial:                  false,
		AuthorizationAuthority:     false,
		FinalityAuthority:          false,
		EntryPointAuthoritative:    true,
		LocalValidationRequired:    true,
		AlternativeBundlersAllowed: true,
		PaymasterNeutral:           true,
		StatusNonCanonical:         true,
		PrivateKeysStored:          false,
		PeerBypassesValidation:     false,
	}
}

type UserOperationIdentity struct {
	ChainID    uint64
	EntryPoint string
	Sender     string
	Nonce      string
	Hash       string
}

func (u UserOperationIdentity) Validate() error {
	if u.ChainID == 0 {
		return errors.New("user operation requires chain id")
	}
	if u.EntryPoint == "" || u.Sender == "" || u.Nonce == "" || u.Hash == "" {
		return errors.New("user operation requires entry point, sender, nonce and hash identity")
	}
	return nil
}

var Invariants = []string{
	"BUNDLER-INV-001", "BUNDLER-INV-002", "BUNDLER-INV-003", "BUNDLER-INV-004",
	"BUNDLER-INV-005", "BUNDLER-INV-006", "BUNDLER-INV-007", "BUNDLER-INV-008",
	"BUNDLER-INV-009", "BUNDLER-INV-010", "BUNDLER-INV-011", "BUNDLER-INV-012",
	"BUNDLER-INV-013", "BUNDLER-INV-014", "BUNDLER-INV-015", "BUNDLER-INV-016",
}
