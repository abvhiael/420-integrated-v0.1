package model

import (
	"errors"
	"strings"
)

const (
	ServiceID  = "420/service/reputation/v1"
	APIVersion = "v1"
)

type Domain string

const (
	DomainMarketplace  Domain = "MARKETPLACE"
	DomainClassifieds  Domain = "CLASSIFIEDS"
	DomainTravel       Domain = "TRAVEL"
	DomainEmployer     Domain = "EMPLOYER"
	DomainFreelancer   Domain = "FREELANCER"
	DomainCreator      Domain = "CREATOR"
	DomainCrowdfunding Domain = "CROWDFUNDING"
	DomainCommunity    Domain = "COMMUNITY"
	DomainEducation    Domain = "EDUCATION"
)

var GenesisDomains = []Domain{
	DomainMarketplace,
	DomainClassifieds,
	DomainTravel,
	DomainEmployer,
	DomainFreelancer,
	DomainCreator,
	DomainCrowdfunding,
	DomainCommunity,
	DomainEducation,
}

func ValidDomain(domain Domain) bool {
	for _, candidate := range GenesisDomains {
		if candidate == domain {
			return true
		}
	}
	return false
}

type SubjectRef struct {
	Type string
	ID   string
}

func (s SubjectRef) Validate() error {
	if strings.TrimSpace(s.Type) == "" {
		return errors.New("reputation subject type is required")
	}
	if strings.TrimSpace(s.ID) == "" {
		return errors.New("reputation subject id is required")
	}
	return nil
}

type TrustMetricRef struct {
	DomainID       string
	UnitID         string
	MetricID       string
	MetricRevision uint32
	Active         bool
	Total          string
	ActiveSignals  uint64
}

func (m TrustMetricRef) Validate() error {
	if strings.TrimSpace(m.DomainID) == "" {
		return errors.New("trust metric domain id is required")
	}
	if strings.TrimSpace(m.UnitID) == "" {
		return errors.New("trust metric unit id is required")
	}
	if strings.TrimSpace(m.MetricID) == "" {
		return errors.New("trust metric id is required")
	}
	if m.MetricRevision == 0 {
		return errors.New("trust metric revision is required")
	}
	return nil
}

type ServiceBoundary struct {
	CanonicalProtocolAuthority bool
	UniversalScore             bool
	CustodyAuthority           bool
	IdentityAuthority          bool
	GovernanceWeight           bool
	ValidatorWeight            bool
	SubjectiveRatingsOnChain   bool
	TrustReadOnly              bool
}

func GenesisBoundary() ServiceBoundary {
	return ServiceBoundary{
		CanonicalProtocolAuthority: false,
		UniversalScore:             false,
		CustodyAuthority:           false,
		IdentityAuthority:          false,
		GovernanceWeight:           false,
		ValidatorWeight:            false,
		SubjectiveRatingsOnChain:   false,
		TrustReadOnly:              true,
	}
}
