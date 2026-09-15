package cohorts

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/420integrated/420-integrated/analytics/architecture"
	"github.com/420integrated/420-integrated/analytics/model"
)

const (
	SchemaVersion      = "420-analytics-cohort-ranking-v1"
	DefaultMinMembers  = 5
	MaxMembersPerBuild = 100000
)

type Definition struct {
	ID          string `json:"id"`
	Version     string `json:"version"`
	Description string `json:"description"`
	MinMembers  int    `json:"minMembers"`
}

type Member struct {
	EntityID string `json:"entityId"`
	Cohort   string `json:"cohort"`
	Score    string `json:"score"`
}

type RankedMember struct {
	Rank     int    `json:"rank"`
	EntityID string `json:"entityId"`
	Score    string `json:"score"`
}

type Cohort struct {
	Key     string         `json:"key"`
	Size    int            `json:"size"`
	Ranking []RankedMember `json:"ranking"`
}

type Result struct {
	SchemaVersion     string            `json:"schemaVersion"`
	ID                string            `json:"id"`
	Definition        Definition        `json:"definition"`
	Provenance        model.Provenance  `json:"provenance"`
	Cohorts           []Cohort          `json:"cohorts"`
	SuppressedCohorts int               `json:"suppressedCohorts"`
	Canonical         bool              `json:"canonical"`
	Rebuildable       bool              `json:"rebuildable"`
}

type normalizedMember struct {
	entityID string
	cohort   string
	score    string
	numeric  float64
}

func Build(def Definition, provenance model.Provenance, members []Member) (Result, error) {
	def.ID = strings.TrimSpace(def.ID)
	def.Version = strings.TrimSpace(def.Version)
	def.Description = strings.TrimSpace(def.Description)
	if def.ID == "" || def.Version == "" || def.Description == "" {
		return Result{}, errors.New("cohort definition id, version and description are required")
	}
	if def.MinMembers == 0 {
		def.MinMembers = DefaultMinMembers
	}
	if def.MinMembers < 2 {
		return Result{}, errors.New("cohort privacy threshold must be at least 2")
	}
	if provenance.Source != string(architecture.SourceIndexer) || provenance.ChainID == 0 || provenance.IndexedHeight == 0 || strings.TrimSpace(provenance.IndexedHeadHash) == "" || provenance.IndexedAt.IsZero() || provenance.SafeHeight > provenance.IndexedHeight {
		return Result{}, errors.New("cohort analytics require qualified 420Indexer provenance")
	}
	if len(members) == 0 {
		return Result{}, errors.New("cohort analytics require members")
	}
	if len(members) > MaxMembersPerBuild {
		return Result{}, fmt.Errorf("cohort build exceeds maximum member count %d", MaxMembersPerBuild)
	}

	seen := make(map[string]struct{}, len(members))
	groups := map[string][]normalizedMember{}
	for i, member := range members {
		entityID := strings.ToLower(strings.TrimSpace(member.EntityID))
		cohort := strings.ToLower(strings.TrimSpace(member.Cohort))
		score := strings.TrimSpace(member.Score)
		if entityID == "" || cohort == "" || score == "" {
			return Result{}, fmt.Errorf("member %d requires entity, cohort and score", i)
		}
		if _, exists := seen[entityID]; exists {
			return Result{}, fmt.Errorf("duplicate cohort entity: %s", entityID)
		}
		seen[entityID] = struct{}{}
		numeric, err := strconv.ParseFloat(score, 64)
		if err != nil || math.IsNaN(numeric) || math.IsInf(numeric, 0) {
			return Result{}, fmt.Errorf("member %s score must be finite numeric text", entityID)
		}
		groups[cohort] = append(groups[cohort], normalizedMember{entityID: entityID, cohort: cohort, score: score, numeric: numeric})
	}

	keys := make([]string, 0, len(groups))
	for key := range groups {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	result := Result{
		SchemaVersion: SchemaVersion,
		Definition:    def,
		Provenance:    provenance,
		Canonical:     false,
		Rebuildable:   true,
	}

	for _, key := range keys {
		group := groups[key]
		if len(group) < def.MinMembers {
			result.SuppressedCohorts++
			continue
		}
		sort.Slice(group, func(i, j int) bool {
			if group[i].numeric == group[j].numeric {
				return group[i].entityID < group[j].entityID
			}
			return group[i].numeric > group[j].numeric
		})
		ranking := make([]RankedMember, len(group))
		for i, member := range group {
			ranking[i] = RankedMember{Rank: i + 1, EntityID: member.entityID, Score: member.score}
		}
		result.Cohorts = append(result.Cohorts, Cohort{Key: key, Size: len(group), Ranking: ranking})
	}

	result.ID = resultID(result)
	if err := Validate(result); err != nil {
		return Result{}, err
	}
	return result, nil
}

func Validate(result Result) error {
	if result.SchemaVersion != SchemaVersion {
		return errors.New("unsupported analytics cohort schema")
	}
	if result.Canonical || !result.Rebuildable {
		return errors.New("analytics cohorts and rankings must be non-canonical and rebuildable")
	}
	if strings.TrimSpace(result.ID) == "" {
		return errors.New("analytics cohort result id required")
	}
	if result.Definition.ID == "" || result.Definition.Version == "" || result.Definition.Description == "" || result.Definition.MinMembers < 2 {
		return errors.New("analytics cohort definition is invalid")
	}
	if result.Provenance.Source != string(architecture.SourceIndexer) || result.Provenance.ChainID == 0 || result.Provenance.IndexedHeight == 0 || result.Provenance.SafeHeight > result.Provenance.IndexedHeight {
		return errors.New("analytics cohort provenance is invalid")
	}
	previousKey := ""
	seenEntities := map[string]struct{}{}
	for i, cohort := range result.Cohorts {
		if cohort.Key == "" || cohort.Size < result.Definition.MinMembers || cohort.Size != len(cohort.Ranking) {
			return fmt.Errorf("cohort %d violates privacy or size contract", i)
		}
		if previousKey != "" && cohort.Key <= previousKey {
			return errors.New("cohort keys must be strictly sorted")
		}
		previousKey = cohort.Key
		var previousScore float64
		previousEntity := ""
		for j, member := range cohort.Ranking {
			if member.Rank != j+1 || member.EntityID == "" || member.Score == "" {
				return fmt.Errorf("cohort %s ranking position %d invalid", cohort.Key, j)
			}
			if _, exists := seenEntities[member.EntityID]; exists {
				return fmt.Errorf("entity appears more than once across cohorts: %s", member.EntityID)
			}
			seenEntities[member.EntityID] = struct{}{}
			score, err := strconv.ParseFloat(member.Score, 64)
			if err != nil || math.IsNaN(score) || math.IsInf(score, 0) {
				return fmt.Errorf("cohort %s ranking score invalid", cohort.Key)
			}
			if j > 0 {
				if score > previousScore {
					return fmt.Errorf("cohort %s ranking is not descending", cohort.Key)
				}
				if score == previousScore && member.EntityID <= previousEntity {
					return fmt.Errorf("cohort %s tie-breaking is not deterministic", cohort.Key)
				}
			}
			previousScore = score
			previousEntity = member.EntityID
		}
	}
	if result.ID != resultID(result) {
		return errors.New("analytics cohort result identity mismatch")
	}
	return nil
}

func resultID(result Result) string {
	parts := []string{
		SchemaVersion,
		result.Definition.ID,
		result.Definition.Version,
		result.Definition.Description,
		strconv.Itoa(result.Definition.MinMembers),
		strconv.FormatUint(result.Provenance.ChainID, 10),
		strconv.FormatUint(result.Provenance.IndexedHeight, 10),
		result.Provenance.IndexedHeadHash,
		strconv.FormatUint(result.Provenance.SafeHeight, 10),
		result.Provenance.IndexedAt.UTC().Format("2006-01-02T15:04:05.999999999Z"),
		strconv.Itoa(result.SuppressedCohorts),
	}
	for _, cohort := range result.Cohorts {
		parts = append(parts, cohort.Key, strconv.Itoa(cohort.Size))
		for _, member := range cohort.Ranking {
			parts = append(parts, strconv.Itoa(member.Rank), member.EntityID, member.Score)
		}
	}
	sum := sha256.Sum256([]byte(strings.Join(parts, "\n")))
	return "cohort_" + hex.EncodeToString(sum[:])
}
