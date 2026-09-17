package curation

import (
	"errors"
	"sort"
	"strings"

	appregistry "github.com/420integrated/420-integrated/appstore/registry"
)

var (
	ErrInvalidCuration      = errors.New("invalid appstore curation metadata")
	ErrCanonicalOverride   = errors.New("curation cannot override canonical registry fields")
	ErrSponsorLabelMissing = errors.New("sponsored placement requires an explicit label")
)

var reservedCanonicalFields = map[string]struct{}{
	"serviceid": {}, "version": {}, "implementation": {}, "codehash": {}, "metadatahash": {},
	"componenttype": {}, "manifesthash": {}, "dependencyroot": {}, "interfacehash": {},
	"active": {}, "blocknumber": {}, "blockhash": {}, "chainid": {}, "network": {},
	"publisher": {}, "owner": {}, "verification": {},
}

type RatingSummary struct {
	Average float64 `json:"average"`
	Count   uint64  `json:"count"`
}

type Metadata struct {
	ServiceID        string            `json:"serviceId"`
	Categories       []string          `json:"categories,omitempty"`
	Featured         bool              `json:"featured,omitempty"`
	Sponsored        bool              `json:"sponsored,omitempty"`
	SponsorLabel     string            `json:"sponsorLabel,omitempty"`
	Description      string            `json:"description,omitempty"`
	Screenshots      []string          `json:"screenshots,omitempty"`
	Rating           RatingSummary     `json:"rating,omitempty"`
	ReviewCount      uint64            `json:"reviewCount,omitempty"`
	Presentation     map[string]string `json:"presentation,omitempty"`
}

type Listing struct {
	Canonical appregistry.VersionRecord `json:"canonical"`
	Curation  Metadata                  `json:"curation"`
	Disclaimer string                    `json:"disclaimer"`
}

func normalizeToken(v string) string { return strings.ToLower(strings.TrimSpace(v)) }

func (m Metadata) Validate() error {
	if strings.TrimSpace(m.ServiceID) == "" { return ErrInvalidCuration }
	if m.Sponsored && strings.TrimSpace(m.SponsorLabel) == "" { return ErrSponsorLabelMissing }
	if !m.Sponsored && strings.TrimSpace(m.SponsorLabel) != "" { return ErrInvalidCuration }
	if m.Rating.Average < 0 || m.Rating.Average > 5 { return ErrInvalidCuration }
	if m.Rating.Count == 0 && m.Rating.Average != 0 { return ErrInvalidCuration }
	for _, category := range m.Categories { if strings.TrimSpace(category) == "" { return ErrInvalidCuration } }
	for key := range m.Presentation {
		if _, reserved := reservedCanonicalFields[normalizeToken(key)]; reserved { return ErrCanonicalOverride }
	}
	return nil
}

func Normalize(m Metadata) (Metadata, error) {
	if err := m.Validate(); err != nil { return Metadata{}, err }
	m.ServiceID = normalizeToken(m.ServiceID)
	seen := map[string]struct{}{}
	categories := make([]string, 0, len(m.Categories))
	for _, raw := range m.Categories {
		v := normalizeToken(raw)
		if _, ok := seen[v]; ok { continue }
		seen[v] = struct{}{}
		categories = append(categories, v)
	}
	sort.Strings(categories)
	m.Categories = categories
	m.SponsorLabel = strings.TrimSpace(m.SponsorLabel)
	m.Description = strings.TrimSpace(m.Description)
	return m, nil
}

func Compose(record appregistry.VersionRecord, metadata Metadata) (Listing, error) {
	normalized, err := Normalize(metadata)
	if err != nil { return Listing{}, err }
	if !strings.EqualFold(strings.TrimSpace(record.ServiceID), normalized.ServiceID) { return Listing{}, ErrInvalidCuration }
	return Listing{
		Canonical: record,
		Curation: normalized,
		Disclaimer: "Catalogue placement, ratings, reviews, featured status and sponsorship are non-canonical presentation metadata and do not constitute protocol endorsement, audit certification or proof of safety.",
	}, nil
}

func Rank(listings []Listing) []Listing {
	out := append([]Listing(nil), listings...)
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Curation.Featured != out[j].Curation.Featured { return out[i].Curation.Featured }
		if out[i].Curation.Sponsored != out[j].Curation.Sponsored { return out[i].Curation.Sponsored }
		if out[i].Curation.Rating.Average != out[j].Curation.Rating.Average { return out[i].Curation.Rating.Average > out[j].Curation.Rating.Average }
		return strings.ToLower(out[i].Canonical.ServiceID) < strings.ToLower(out[j].Canonical.ServiceID)
	})
	return out
}
