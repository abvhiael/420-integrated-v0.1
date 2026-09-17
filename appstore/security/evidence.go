package security

import (
	"errors"
	"sort"
	"strings"
)

var (
	ErrInvalidEvidence = errors.New("invalid security evidence")
	ErrUnsafeClaim      = errors.New("security evidence cannot imply safety or endorsement")
)

type Severity string

const (
	SeverityInfo     Severity = "INFO"
	SeverityWarning  Severity = "WARNING"
	SeverityCritical Severity = "CRITICAL"
)

type EvidenceKind string

const (
	KindVerification EvidenceKind = "VERIFICATION"
	KindAudit        EvidenceKind = "AUDIT"
	KindPublisher    EvidenceKind = "PUBLISHER"
	KindDeprecation  EvidenceKind = "DEPRECATION"
	KindMalicious    EvidenceKind = "MALICIOUS_WARNING"
	KindTrust        EvidenceKind = "TRUST_SIGNAL"
)

type Evidence struct {
	Kind       EvidenceKind `json:"kind"`
	Source     string       `json:"source"`
	Reference  string       `json:"reference"`
	Status     string       `json:"status"`
	Severity   Severity     `json:"severity"`
	ObservedAt uint64       `json:"observedAt"`
	Summary    string       `json:"summary,omitempty"`
}

type Presentation struct {
	ServiceID string     `json:"serviceId"`
	Version   uint32     `json:"version"`
	Evidence  []Evidence `json:"evidence"`
	Warnings  []Evidence `json:"warnings"`
	Disclaimer string    `json:"disclaimer"`
}

func Validate(e Evidence) error {
	if strings.TrimSpace(e.Source) == "" || strings.TrimSpace(e.Reference) == "" || strings.TrimSpace(e.Status) == "" || e.ObservedAt == 0 {
		return ErrInvalidEvidence
	}
	switch e.Kind {
	case KindVerification, KindAudit, KindPublisher, KindDeprecation, KindMalicious, KindTrust:
	default:
		return ErrInvalidEvidence
	}
	switch e.Severity {
	case SeverityInfo, SeverityWarning, SeverityCritical:
	default:
		return ErrInvalidEvidence
	}
	claim := strings.ToLower(e.Status + " " + e.Summary)
	for _, forbidden := range []string{"safe", "approved investment", "endorsed", "guaranteed secure"} {
		if strings.Contains(claim, forbidden) { return ErrUnsafeClaim }
	}
	return nil
}

func Build(serviceID string, version uint32, evidence []Evidence) (Presentation, error) {
	if strings.TrimSpace(serviceID) == "" || version == 0 { return Presentation{}, ErrInvalidEvidence }
	items := append([]Evidence(nil), evidence...)
	for _, e := range items { if err := Validate(e); err != nil { return Presentation{}, err } }
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].ObservedAt != items[j].ObservedAt { return items[i].ObservedAt > items[j].ObservedAt }
		if items[i].Kind != items[j].Kind { return items[i].Kind < items[j].Kind }
		return items[i].Source < items[j].Source
	})
	warnings := make([]Evidence, 0)
	for _, e := range items {
		if e.Severity == SeverityWarning || e.Severity == SeverityCritical || e.Kind == KindDeprecation || e.Kind == KindMalicious { warnings = append(warnings, e) }
	}
	return Presentation{
		ServiceID: strings.ToLower(strings.TrimSpace(serviceID)),
		Version: version,
		Evidence: items,
		Warnings: warnings,
		Disclaimer: "Verification, audits, publisher records and trust signals are evidence, not proof of safety, endorsement or future behavior.",
	}, nil
}
