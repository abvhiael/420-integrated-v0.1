package curation

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"io"
	"regexp"
	"strings"

	"github.com/420integrated/420-integrated/appstore/hardening"
)

//go:embed genesis-apps.json
var genesisApps []byte

type ReleaseStatus string

const (
	Planned             ReleaseStatus = "planned"
	LocallyImplemented  ReleaseStatus = "locally-implemented"
	TestnetQualified    ReleaseStatus = "testnet-qualified"
	ProductionAvailable ReleaseStatus = "production-available"
)

type Expression struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Status      ReleaseStatus `json:"status"`
	Description string        `json:"description"`
}

// GenesisApplication describes approved product scope. Its service ID is a
// reference for discovery, with no Registry version, contract or launch data.
type GenesisApplication struct {
	ServiceID      string       `json:"serviceId"`
	Name           string       `json:"name"`
	Classification string       `json:"classification"`
	Category       string       `json:"category"`
	Description    string       `json:"description"`
	HelpRoute      string       `json:"helpRoute"`
	Expressions    []Expression `json:"expressions"`
}

var (
	serviceIDPattern = regexp.MustCompile(`^420/service/[a-z0-9]+(?:-[a-z0-9]+)*/v[1-9][0-9]*$`)
	tokenPattern     = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
	helpRoutePattern = regexp.MustCompile(`^apps/(?:[a-z0-9-]+/)+$`)
)

func GenesisApplications() ([]GenesisApplication, error) {
	return decodeGenesisApplications(genesisApps)
}

func decodeGenesisApplications(raw []byte) ([]GenesisApplication, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var apps []GenesisApplication
	if err := decoder.Decode(&apps); err != nil || len(apps) == 0 || decoder.Decode(new(any)) != io.EOF {
		return nil, ErrInvalidCuration
	}
	seen := make(map[string]bool, len(apps))
	for _, app := range apps {
		if !serviceIDPattern.MatchString(app.ServiceID) || seen[app.ServiceID] ||
			!tokenPattern.MatchString(app.Category) || !helpRoutePattern.MatchString(app.HelpRoute) ||
			(app.Classification != "GENESIS_PROTOCOL_AND_USER_APP" && app.Classification != "GENESIS_USER_APP") ||
			!validGenesisCopy(app.Name, app.Description) || len(app.Expressions) == 0 {
			return nil, ErrInvalidCuration
		}
		seen[app.ServiceID] = true
		expressions := make(map[string]bool, len(app.Expressions))
		for _, expression := range app.Expressions {
			if !tokenPattern.MatchString(expression.ID) || expressions[expression.ID] ||
				!validGenesisCopy(expression.Name, expression.Description) {
				return nil, ErrInvalidCuration
			}
			switch expression.Status {
			case Planned, LocallyImplemented, TestnetQualified, ProductionAvailable:
			default:
				return nil, ErrInvalidCuration
			}
			expressions[expression.ID] = true
		}
	}
	return apps, nil
}

func validGenesisCopy(name, description string) bool {
	return strings.TrimSpace(name) != "" && len(name) <= 80 && strings.TrimSpace(description) != "" &&
		hardening.ValidateMetadata(hardening.Metadata{Description: description}) == nil
}
