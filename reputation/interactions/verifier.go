package interactions

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
)

type Kind string

const (
	KindPurchase           Kind = "PURCHASE"
	KindSale               Kind = "SALE"
	KindP2PTransaction     Kind = "P2P_TRANSACTION"
	KindLocalHandoff       Kind = "LOCAL_HANDOFF"
	KindShippedTransaction Kind = "SHIPPED_TRANSACTION"
	KindStay               Kind = "STAY"
	KindBooking            Kind = "BOOKING"
	KindEventAttendance    Kind = "EVENT_ATTENDANCE"
	KindPlaceVisit         Kind = "PLACE_VISIT"
	KindEmployment         Kind = "EMPLOYMENT"
	KindInterview          Kind = "INTERVIEW"
	KindGigContract        Kind = "GIG_CONTRACT"
	KindMilestone          Kind = "MILESTONE"
	KindSubscription       Kind = "SUBSCRIPTION"
	KindBacking            Kind = "BACKING"
	KindContribution       Kind = "CONTRIBUTION"
	KindRewardDelivery     Kind = "REWARD_DELIVERY"
	KindMembership         Kind = "MEMBERSHIP"
	KindModerationAction   Kind = "MODERATION_ACTION"
	KindEnrollment         Kind = "ENROLLMENT"
	KindCourseCompletion   Kind = "COURSE_COMPLETION"
	KindCredential         Kind = "CREDENTIAL"
)

type Evidence struct {
	Kind        Kind
	EvidenceRef string
	IssuerID    string
	Reviewer    model.SubjectRef
	Subject     model.SubjectRef
	OccurredAt  time.Time
	Source      string
	Final       bool
}

func (e Evidence) Validate() error {
	if e.Kind == "" {
		return errors.New("interaction kind is required")
	}
	if strings.TrimSpace(e.EvidenceRef) == "" {
		return errors.New("interaction evidence ref is required")
	}
	if strings.TrimSpace(e.IssuerID) == "" {
		return errors.New("interaction issuer id is required")
	}
	if err := e.Reviewer.Validate(); err != nil {
		return err
	}
	if err := e.Subject.Validate(); err != nil {
		return err
	}
	if e.Reviewer.Type == e.Subject.Type && e.Reviewer.ID == e.Subject.ID {
		return errors.New("interaction cannot verify self-review")
	}
	if e.OccurredAt.IsZero() {
		return errors.New("interaction occurred time is required")
	}
	if strings.TrimSpace(e.Source) == "" {
		return errors.New("interaction source is required")
	}
	if !e.Final {
		return errors.New("interaction evidence is not final")
	}
	return nil
}

type Source interface {
	Verify(context.Context, string) (Evidence, error)
}

type Verifier struct {
	sources map[Kind]Source
	domains map[model.Domain]map[Kind]struct{}
}

func NewVerifier(sources map[Kind]Source) (*Verifier, error) {
	if len(sources) == 0 {
		return nil, errors.New("verified interaction sources are required")
	}
	out := make(map[Kind]Source, len(sources))
	for kind, source := range sources {
		if !knownKind(kind) {
			return nil, fmt.Errorf("unknown interaction kind %q", kind)
		}
		if source == nil {
			return nil, fmt.Errorf("interaction source %s is nil", kind)
		}
		out[kind] = source
	}
	return &Verifier{sources: out, domains: genesisDomainKinds()}, nil
}

func (v *Verifier) Verify(ctx context.Context, domain model.Domain, kind Kind, evidenceRef string, reviewer, subject model.SubjectRef) (Evidence, error) {
	if !model.ValidDomain(domain) {
		return Evidence{}, errors.New("interaction domain is invalid")
	}
	if _, ok := v.domains[domain][kind]; !ok {
		return Evidence{}, fmt.Errorf("interaction kind %s is not valid for domain %s", kind, domain)
	}
	source, ok := v.sources[kind]
	if !ok {
		return Evidence{}, fmt.Errorf("interaction source not configured for %s", kind)
	}
	evidence, err := source.Verify(ctx, strings.TrimSpace(evidenceRef))
	if err != nil {
		return Evidence{}, err
	}
	if evidence.Kind != kind || strings.TrimSpace(evidence.EvidenceRef) != strings.TrimSpace(evidenceRef) {
		return Evidence{}, errors.New("interaction evidence source mismatch")
	}
	if evidence.Reviewer != reviewer || evidence.Subject != subject {
		return Evidence{}, errors.New("interaction participants do not match review")
	}
	if err := evidence.Validate(); err != nil {
		return Evidence{}, err
	}
	return evidence, nil
}

func knownKind(kind Kind) bool {
	for _, kinds := range genesisDomainKinds() {
		if _, ok := kinds[kind]; ok {
			return true
		}
	}
	return false
}

func genesisDomainKinds() map[model.Domain]map[Kind]struct{} {
	m := func(kinds ...Kind) map[Kind]struct{} {
		out := make(map[Kind]struct{}, len(kinds))
		for _, kind := range kinds { out[kind] = struct{}{} }
		return out
	}
	return map[model.Domain]map[Kind]struct{}{
		model.DomainMarketplace:  m(KindPurchase, KindSale),
		model.DomainClassifieds:  m(KindP2PTransaction, KindLocalHandoff, KindShippedTransaction),
		model.DomainTravel:       m(KindStay, KindBooking, KindEventAttendance, KindPlaceVisit),
		model.DomainEmployer:     m(KindEmployment, KindInterview),
		model.DomainFreelancer:   m(KindGigContract, KindMilestone),
		model.DomainCreator:      m(KindSubscription, KindPurchase, KindBacking),
		model.DomainCrowdfunding: m(KindContribution, KindRewardDelivery),
		model.DomainCommunity:    m(KindMembership, KindModerationAction),
		model.DomainEducation:    m(KindEnrollment, KindCourseCompletion, KindCredential),
	}
}
