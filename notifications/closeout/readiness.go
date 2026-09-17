package closeout

import (
	"errors"

	"github.com/420integrated/420-integrated/notifications/architecture"
)

const Phase = "NOTIFY-10"

type Evidence struct {
	InvariantSuitePassed        bool
	ReplayDeterminismPassed     bool
	DeduplicationPassed         bool
	RestartRecoveryPassed       bool
	FailureInjectionPassed      bool
	ProviderIsolationPassed     bool
	PrivacySecurityPassed       bool
	GenesisFrontendPassed       bool
	CanonicalAuthorityClaimed   bool
}

type Report struct {
	Phase       string
	ServiceID   string
	Invariants  []string
	Evidence    Evidence
}

func GenesisReport(e Evidence) Report {
	return Report{
		Phase: Phase,
		ServiceID: architecture.ServiceID,
		Invariants: append([]string(nil), architecture.Invariants...),
		Evidence: e,
	}
}

func (r Report) Validate() error {
	if r.Phase != Phase { return errors.New("unexpected closeout phase") }
	if r.ServiceID != architecture.ServiceID { return errors.New("unexpected notifications service id") }
	if len(r.Invariants) != 14 { return errors.New("complete notifications invariant set is required") }
	b := architecture.GenesisBoundary()
	if b.ContractsRequired || b.CanonicalStateAuthority || b.PrivatePayloadsIndexed {
		return errors.New("genesis authority/privacy boundary violated")
	}
	if !b.IndexerPublicAPIOnly || !b.ConsumerCheckpointPrivate || !b.SubscriptionsPrivate || !b.DeliveryEndpointsPrivate || !b.PromotionalConsentSeparate || !b.WalletAuthoritative || !b.AlternativeProviders {
		return errors.New("genesis boundary is incomplete")
	}
	e := r.Evidence
	if e.CanonicalAuthorityClaimed { return errors.New("notifications cannot claim canonical authority") }
	if !e.InvariantSuitePassed || !e.ReplayDeterminismPassed || !e.DeduplicationPassed || !e.RestartRecoveryPassed || !e.FailureInjectionPassed || !e.ProviderIsolationPassed || !e.PrivacySecurityPassed || !e.GenesisFrontendPassed {
		return errors.New("notifications genesis qualification evidence incomplete")
	}
	return nil
}
