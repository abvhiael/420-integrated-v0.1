package result

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
)

const SchemaVersion = "420-search-result-v1"

type Finality string

const (
	FinalityUnknown   Finality = "unknown"
	FinalityHead      Finality = "head"
	FinalitySafe      Finality = "safe"
	FinalityFinalized Finality = "finalized"
)

type Provenance struct {
	Source        architecture.SourceBoundary `json:"source"`
	Authority     string                      `json:"authority"`
	ChainID       uint64                      `json:"chainId,omitempty"`
	BlockNumber   *uint64                     `json:"blockNumber,omitempty"`
	BlockHash     string                      `json:"blockHash,omitempty"`
	TransactionHash string                    `json:"transactionHash,omitempty"`
	LogIndex      *uint64                     `json:"logIndex,omitempty"`
	Finality      Finality                    `json:"finality"`
	IndexedAt     time.Time                   `json:"indexedAt"`
	IndexedHeight *uint64                     `json:"indexedHeight,omitempty"`
	FinalizedHeight *uint64                   `json:"finalizedHeight,omitempty"`
}

type Presentation struct {
	Title       string   `json:"title"`
	Subtitle    string   `json:"subtitle,omitempty"`
	Snippet     string   `json:"snippet,omitempty"`
	Category    string   `json:"category,omitempty"`
	CanonicalURL string  `json:"canonicalUrl"`
	Tags        []string `json:"tags,omitempty"`
}

type Ranking struct {
	Score     float64  `json:"score"`
	Signals   []string `json:"signals,omitempty"`
	Ranker    string   `json:"ranker"`
	Canonical bool     `json:"canonical"`
}

type Sponsorship struct {
	Sponsored bool   `json:"sponsored"`
	Label     string `json:"label,omitempty"`
	Campaign  string `json:"campaign,omitempty"`
	Canonical bool   `json:"canonical"`
}

type Result struct {
	Schema       string                    `json:"schema"`
	ID           string                    `json:"id"`
	Domain       architecture.ResultDomain `json:"domain"`
	SourceKey    string                    `json:"sourceKey"`
	Mode         architecture.SearchMode   `json:"mode"`
	Provenance   Provenance                `json:"provenance"`
	Presentation Presentation              `json:"presentation"`
	Ranking      Ranking                   `json:"ranking"`
	Sponsorship  Sponsorship               `json:"sponsorship"`
}

func StableID(domain architecture.ResultDomain, source architecture.SourceBoundary, sourceKey string) (string, error) {
	sourceKey = strings.TrimSpace(sourceKey)
	if domain == "" || source == "" || sourceKey == "" {
		return "", errors.New("domain, source and sourceKey are required")
	}
	material := fmt.Sprintf("%s|%s|%s|%s", SchemaVersion, domain, source, strings.ToLower(sourceKey))
	sum := sha256.Sum256([]byte(material))
	return "srch_" + hex.EncodeToString(sum[:]), nil
}

func New(domain architecture.ResultDomain, sourceKey string, mode architecture.SearchMode, provenance Provenance, presentation Presentation) (Result, error) {
	id, err := StableID(domain, provenance.Source, sourceKey)
	if err != nil { return Result{}, err }
	if provenance.Authority == "" { return Result{}, errors.New("source authority required") }
	if provenance.Finality == "" { provenance.Finality = FinalityUnknown }
	if provenance.IndexedAt.IsZero() { return Result{}, errors.New("indexedAt required") }
	if strings.TrimSpace(presentation.Title) == "" { return Result{}, errors.New("title required") }
	if strings.TrimSpace(presentation.CanonicalURL) == "" { return Result{}, errors.New("canonical URL required") }
	if mode != architecture.SearchModeResolver && mode != architecture.SearchModeDiscovery {
		return Result{}, errors.New("invalid search mode")
	}
	return Result{
		Schema: SchemaVersion,
		ID: id,
		Domain: domain,
		SourceKey: sourceKey,
		Mode: mode,
		Provenance: provenance,
		Presentation: presentation,
		Ranking: Ranking{Ranker: "unranked", Canonical: false},
		Sponsorship: Sponsorship{Sponsored: false, Canonical: false},
	}, nil
}

func (r Result) Validate() error {
	if r.Schema != SchemaVersion { return errors.New("unsupported result schema") }
	expected, err := StableID(r.Domain, r.Provenance.Source, r.SourceKey)
	if err != nil { return err }
	if r.ID != expected { return errors.New("unstable or forged result id") }
	if r.Provenance.Authority == "" { return errors.New("source authority required") }
	if r.Provenance.IndexedAt.IsZero() { return errors.New("indexedAt required") }
	if r.Presentation.Title == "" || r.Presentation.CanonicalURL == "" { return errors.New("presentation identity incomplete") }
	if r.Ranking.Canonical { return errors.New("ranking must remain non-canonical") }
	if r.Sponsorship.Canonical { return errors.New("sponsorship must remain non-canonical") }
	if r.Sponsorship.Sponsored && strings.TrimSpace(r.Sponsorship.Label) == "" { return errors.New("sponsored result must be explicitly labeled") }
	return nil
}
