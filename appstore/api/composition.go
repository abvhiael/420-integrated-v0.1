package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/420integrated/420-integrated/appstore/catalog"
	"github.com/420integrated/420-integrated/appstore/curation"
	"github.com/420integrated/420-integrated/appstore/hardening"
	"github.com/420integrated/420-integrated/appstore/security"
	"github.com/420integrated/420-integrated/appstore/wallet"
)

const CompositionInputsSchemaVersion = 1

var (
	ErrInvalidCompositionInputs = errors.New("invalid appstore ApplicationView composition inputs")
	ErrUnknownCompositionApp    = errors.New("ApplicationView input does not match canonical Registry service")
)

type WalletInput struct {
	AppURL               string                   `json:"appUrl,omitempty"`
	Action               string                   `json:"action,omitempty"`
	Permissions          []wallet.Permission      `json:"permissions,omitempty"`
	Capabilities         []wallet.CapabilityScope `json:"capabilities,omitempty"`
	RequiresConfirmation bool                     `json:"requiresConfirmation,omitempty"`
}

type ViewInput struct {
	ServiceID string            `json:"serviceId"`
	Curation  curation.Metadata `json:"curation,omitempty"`
	Evidence  []security.Evidence `json:"evidence,omitempty"`
	Wallet    WalletInput       `json:"wallet,omitempty"`
	Links     Links             `json:"links,omitempty"`
}

type CompositionInputs struct {
	SchemaVersion int         `json:"schemaVersion"`
	Applications  []ViewInput `json:"applications,omitempty"`
}

// LoadCompositionInputs reads optional operator-controlled, non-canonical view
// inputs. An empty path means no enrichments are configured. JSON decoding is
// strict so authority-bearing or misspelled fields cannot be silently ignored.
func LoadCompositionInputs(path string) (CompositionInputs, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return CompositionInputs{SchemaVersion: CompositionInputsSchemaVersion}, nil
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return CompositionInputs{}, fmt.Errorf("read ApplicationView inputs: %w", err)
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	var inputs CompositionInputs
	if err := dec.Decode(&inputs); err != nil {
		return CompositionInputs{}, fmt.Errorf("%w: %v", ErrInvalidCompositionInputs, err)
	}
	if dec.More() {
		return CompositionInputs{}, ErrInvalidCompositionInputs
	}
	if inputs.SchemaVersion != CompositionInputsSchemaVersion {
		return CompositionInputs{}, ErrInvalidCompositionInputs
	}
	return inputs, nil
}

// ComposeApplications builds one ApplicationView per canonical service using
// the highest Registry version present in the finalized APPSTORE-3 catalogue.
// Presentation sources can enrich a canonical record but cannot select,
// rewrite or manufacture canonical identity/version/implementation fields.
func ComposeApplications(doc catalog.Document, chainID uint64, inputs CompositionInputs) ([]ApplicationView, error) {
	if doc.SchemaVersion != catalog.SchemaVersion || doc.ChainID == 0 || doc.ChainID != chainID {
		return nil, ErrInvalidCompositionInputs
	}
	if inputs.SchemaVersion != CompositionInputsSchemaVersion {
		return nil, ErrInvalidCompositionInputs
	}

	latest := make(map[string]catalogVersion)
	for _, record := range doc.Versions {
		id := strings.ToLower(strings.TrimSpace(record.ServiceID))
		if id == "" {
			return nil, ErrInvalidCompositionInputs
		}
		current, ok := latest[id]
		if !ok || record.Version > current.record.Version {
			latest[id] = catalogVersion{record: record}
		}
	}

	byID := make(map[string]ViewInput, len(inputs.Applications))
	for _, input := range inputs.Applications {
		id := strings.ToLower(strings.TrimSpace(input.ServiceID))
		if id == "" {
			return nil, ErrInvalidCompositionInputs
		}
		if _, ok := latest[id]; !ok {
			return nil, ErrUnknownCompositionApp
		}
		if _, duplicate := byID[id]; duplicate {
			return nil, ErrInvalidCompositionInputs
		}
		byID[id] = input
	}

	ids := make([]string, 0, len(latest))
	for id := range latest {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	views := make([]ApplicationView, 0, len(ids))
	for _, id := range ids {
		record := latest[id].record
		input := byID[id]

		metadata := input.Curation
		if strings.TrimSpace(metadata.ServiceID) == "" {
			metadata.ServiceID = id
		} else if !strings.EqualFold(strings.TrimSpace(metadata.ServiceID), id) {
			return nil, ErrInvalidCompositionInputs
		}
		listing, err := curation.Compose(record, metadata)
		if err != nil {
			return nil, fmt.Errorf("compose curation for %s: %w", id, err)
		}
		if err := hardening.ValidateMetadata(hardening.Metadata{
			Description:  listing.Curation.Description,
			Screenshots:  listing.Curation.Screenshots,
			Presentation: listing.Curation.Presentation,
		}); err != nil {
			return nil, fmt.Errorf("validate curation for %s: %w", id, err)
		}

		sec, err := security.Build(id, record.Version, input.Evidence)
		if err != nil {
			return nil, fmt.Errorf("compose security evidence for %s: %w", id, err)
		}

		links := input.Links
		appURL := strings.TrimSpace(input.Wallet.AppURL)
		directURL := strings.TrimSpace(links.Direct)
		if appURL == "" {
			appURL = directURL
		}
		if directURL == "" {
			links.Direct = appURL
			directURL = appURL
		}
		if appURL != "" && directURL != "" && appURL != directURL {
			return nil, fmt.Errorf("%w: wallet/direct URL mismatch for %s", ErrInvalidCompositionInputs, id)
		}

		var walletView wallet.Presentation
		if appURL != "" {
			walletView, err = wallet.Build(wallet.Request{
				ChainID:              chainID,
				ServiceID:            id,
				AppURL:               appURL,
				Action:               input.Wallet.Action,
				Permissions:          input.Wallet.Permissions,
				Capabilities:         input.Wallet.Capabilities,
				RequiresConfirmation: input.Wallet.RequiresConfirmation,
			})
			if err != nil {
				return nil, fmt.Errorf("compose wallet handoff for %s: %w", id, err)
			}
		} else if strings.TrimSpace(input.Wallet.Action) != "" || len(input.Wallet.Permissions) != 0 || len(input.Wallet.Capabilities) != 0 || input.Wallet.RequiresConfirmation {
			return nil, fmt.Errorf("%w: wallet metadata requires app URL for %s", ErrInvalidCompositionInputs, id)
		}

		view := ApplicationView{
			Listing:  listing,
			Security: sec,
			Wallet:   walletView,
			Links:    links,
		}
		if err := validateComposedApplicationView(view); err != nil {
			return nil, fmt.Errorf("validate ApplicationView for %s: %w", id, err)
		}
		views = append(views, view)
	}
	return views, nil
}

type catalogVersion struct {
	record catalogVersionRecord
}

// catalogVersionRecord aliases the concrete registry record without allowing
// composition code to invent a second canonical model.
type catalogVersionRecord = struct {
	ServiceID      string `json:"serviceId"`
	Version        uint32 `json:"version"`
	Implementation string `json:"implementation"`
	CodeHash       string `json:"codeHash"`
	MetadataHash   string `json:"metadataHash"`
	ComponentType  uint8  `json:"componentType"`
	ManifestHash   string `json:"manifestHash"`
	DependencyRoot string `json:"dependencyRoot"`
	InterfaceHash  string `json:"interfaceHash"`
	Active         bool   `json:"active"`
	BlockNumber    uint64 `json:"blockNumber"`
	BlockHash      string `json:"blockHash"`
}

func validateComposedApplicationView(view ApplicationView) error {
	_, err := New([]ApplicationView{view})
	return err
}
