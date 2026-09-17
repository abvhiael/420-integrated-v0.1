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
	ErrInvalidPolicy        = errors.New("invalid appstore catalogue policy")
)

const (
	maxCategories  = 16
	maxScreenshots = 12
	maxDescription = 4096
	maxPresentationFields = 32
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
	ServiceID    string            `json:"serviceId"`
	Categories   []string          `json:"categories,omitempty"`
	Featured     bool              `json:"featured,omitempty"`
	Sponsored    bool              `json:"sponsored,omitempty"`
	SponsorLabel string            `json:"sponsorLabel,omitempty"`
	Description  string            `json:"description,omitempty"`
	Screenshots  []string          `json:"screenshots,omitempty"`
	Rating       RatingSummary     `json:"rating,omitempty"`
	ReviewCount  uint64            `json:"reviewCount,omitempty"`
	Presentation map[string]string `json:"presentation,omitempty"`
}

type Listing struct {
	Canonical  appregistry.VersionRecord `json:"canonical"`
	Curation   Metadata                  `json:"curation"`
	Disclaimer string                    `json:"disclaimer"`
}

type RankingPolicy struct {
	Name             string `json:"name"`
	PreferFeatured   bool   `json:"preferFeatured"`
	PreferSponsored  bool   `json:"preferSponsored"`
	PreferRating     bool   `json:"preferRating"`
}

func DefaultRankingPolicy() RankingPolicy {
	return RankingPolicy{Name: "420-appstore-default", PreferFeatured: true, PreferSponsored: true, PreferRating: true}
}

func normalizeToken(v string) string { return strings.ToLower(strings.TrimSpace(v)) }

func normalizeDistinct(values []string, lower bool) ([]string, error) {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, raw := range values {
		v := strings.TrimSpace(raw)
		if lower { v = strings.ToLower(v) }
		if v == "" { return nil, ErrInvalidCuration }
		key := strings.ToLower(v)
		if _, ok := seen[key]; ok { continue }
		seen[key] = struct{}{}
		out = append(out, v)
	}
	return out, nil
}

func (m Metadata) Validate() error {
	if strings.TrimSpace(m.ServiceID) == "" { return ErrInvalidCuration }
	if len(m.Categories) > maxCategories || len(m.Screenshots) > maxScreenshots || len(m.Presentation) > maxPresentationFields { return ErrInvalidCuration }
	if len(strings.TrimSpace(m.Description)) > maxDescription { return ErrInvalidCuration }
	if m.Sponsored && strings.TrimSpace(m.SponsorLabel) == "" { return ErrSponsorLabelMissing }
	if !m.Sponsored && strings.TrimSpace(m.SponsorLabel) != "" { return ErrInvalidCuration }
	if m.Rating.Average < 0 || m.Rating.Average > 5 { return ErrInvalidCuration }
	if m.Rating.Count == 0 && m.Rating.Average != 0 { return ErrInvalidCuration }
	if m.ReviewCount > m.Rating.Count { return ErrInvalidCuration }
	for _, category := range m.Categories { if strings.TrimSpace(category) == "" { return ErrInvalidCuration } }
	for _, screenshot := range m.Screenshots { if strings.TrimSpace(screenshot) == "" { return ErrInvalidCuration } }
	for key, value := range m.Presentation {
		key = normalizeToken(key)
		if key == "" || strings.TrimSpace(value) == "" { return ErrInvalidCuration }
		if _, reserved := reservedCanonicalFields[key]; reserved { return ErrCanonicalOverride }
	}
	return nil
}

func Normalize(m Metadata) (Metadata, error) {
	if err := m.Validate(); err != nil { return Metadata{}, err }
	m.ServiceID = normalizeToken(m.ServiceID)
	categories, err := normalizeDistinct(m.Categories, true)
	if err != nil { return Metadata{}, err }
	sort.Strings(categories)
	m.Categories = categories
	screenshots, err := normalizeDistinct(m.Screenshots, false)
	if err != nil { return Metadata{}, err }
	m.Screenshots = screenshots
	m.SponsorLabel = strings.TrimSpace(m.SponsorLabel)
	m.Description = strings.TrimSpace(m.Description)
	if len(m.Presentation) > 0 {
		presentation := make(map[string]string, len(m.Presentation))
		for key, value := range m.Presentation {
			presentation[normalizeToken(key)] = strings.TrimSpace(value)
		}
		m.Presentation = presentation
	}
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

func (p RankingPolicy) Validate() error {
	if strings.TrimSpace(p.Name) == "" { return ErrInvalidPolicy }
	return nil
}

func RankWithPolicy(listings []Listing, policy RankingPolicy) ([]Listing, error) {
	if err := policy.Validate(); err != nil { return nil, err }
	out := append([]Listing(nil), listings...)
	sort.SliceStable(out, func(i, j int) bool {
		if policy.PreferFeatured && out[i].Curation.Featured != out[j].Curation.Featured { return out[i].Curation.Featured }
		if policy.PreferSponsored && out[i].Curation.Sponsored != out[j].Curation.Sponsored { return out[i].Curation.Sponsored }
		if policy.PreferRating && out[i].Curation.Rating.Average != out[j].Curation.Rating.Average { return out[i].Curation.Rating.Average > out[j].Curation.Rating.Average }
		if !strings.EqualFold(out[i].Canonical.ServiceID, out[j].Canonical.ServiceID) { return strings.ToLower(out[i].Canonical.ServiceID) < strings.ToLower(out[j].Canonical.ServiceID) }
		return out[i].Canonical.Version < out[j].Canonical.Version
	})
	return out, nil
}

func Rank(listings []Listing) []Listing {
	out, err := RankWithPolicy(listings, DefaultRankingPolicy())
	if err != nil { return append([]Listing(nil), listings...) }
	return out
}
