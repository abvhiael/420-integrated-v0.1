package closeout

import (
	"errors"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/httpapi"
	"github.com/420integrated/420-integrated/search/pagination"
	"github.com/420integrated/420-integrated/search/privacy"
	"github.com/420integrated/420-integrated/search/query"
	"github.com/420integrated/420-integrated/search/ranking"
	searchruntime "github.com/420integrated/420-integrated/search/runtime"
)

const (
	CloseoutVersion = "420-search-genesis-closeout-v1"
	CloseoutPhase   = "SEARCH-10"
)

var CompletedPhases = []string{
	"SEARCH-0",
	"SEARCH-1",
	"SEARCH-2",
	"SEARCH-3.1",
	"SEARCH-3.2",
	"SEARCH-3.3",
	"SEARCH-3.4",
	"SEARCH-3.5",
	"SEARCH-4.1",
	"SEARCH-4.2",
	"SEARCH-4.3",
	"SEARCH-4.4",
	"SEARCH-5",
	"SEARCH-6.1",
	"SEARCH-6.2",
	"SEARCH-6.3",
	"SEARCH-7.1",
	"SEARCH-7.2",
	"SEARCH-7.3",
	"SEARCH-8",
	"SEARCH-9",
	"SEARCH-10",
}

type Manifest struct {
	Version                      string
	Phase                        string
	Service                      string
	ServiceID                    string
	IndexerConsumerQualification string
	HTTPAPI                      string
	QuerySchema                  string
	CursorSchema                 string
	Ranker                       string
	PrivacyAdmission             string
	Runtime                      string
	CanonicalAuthority           bool
	DirectRPC                    bool
	ContractsRequired            bool
	SearchIndexRebuildable       bool
	GenesisDomains               []architecture.ResultDomain
	PrivacyExclusions            []architecture.PrivacyExclusion
	InvariantIDs                 []string
	CompletedPhases              []string
}

func GenesisManifest() Manifest {
	profile := architecture.GenesisProfile()
	return Manifest{
		Version: CloseoutVersion,
		Phase: CloseoutPhase,
		Service: profile.ServiceName,
		ServiceID: profile.ServiceID,
		IndexerConsumerQualification: architecture.IndexerConsumerQualification,
		HTTPAPI: httpapi.APIVersion,
		QuerySchema: query.SchemaVersion,
		CursorSchema: pagination.CursorSchema,
		Ranker: ranking.RankerVersion,
		PrivacyAdmission: privacy.AdmissionVersion,
		Runtime: searchruntime.RuntimeVersion,
		CanonicalAuthority: profile.CanonicalStateAuthority,
		DirectRPC: profile.SearchMayUseDirectRPC,
		ContractsRequired: profile.ContractsRequired,
		SearchIndexRebuildable: profile.SearchIndexRebuildable,
		GenesisDomains: append([]architecture.ResultDomain(nil), profile.Domains...),
		PrivacyExclusions: append([]architecture.PrivacyExclusion(nil), profile.PrivacyExclusions...),
		InvariantIDs: append([]string(nil), profile.InvariantIDs...),
		CompletedPhases: append([]string(nil), CompletedPhases...),
	}
}

func ValidateGenesisManifest(m Manifest) error {
	if m.Version != CloseoutVersion || m.Phase != CloseoutPhase {
		return errors.New("invalid 420Search closeout version or phase")
	}
	if m.Service != architecture.ServiceName || m.ServiceID != architecture.ServiceID {
		return errors.New("420Search service identity drifted")
	}
	if m.IndexerConsumerQualification != architecture.IndexerConsumerQualification {
		return errors.New("420Search Indexer qualification drifted")
	}
	if m.HTTPAPI != httpapi.APIVersion || m.QuerySchema != query.SchemaVersion || m.CursorSchema != pagination.CursorSchema || m.Ranker != ranking.RankerVersion || m.PrivacyAdmission != privacy.AdmissionVersion || m.Runtime != searchruntime.RuntimeVersion {
		return errors.New("420Search version contract drifted")
	}
	if m.CanonicalAuthority || m.DirectRPC || m.ContractsRequired || !m.SearchIndexRebuildable {
		return errors.New("420Search architecture authority boundary drifted")
	}
	if len(m.GenesisDomains) != len(architecture.GenesisDomains) || len(m.PrivacyExclusions) != len(architecture.PrivacyExclusions) || len(m.InvariantIDs) != len(architecture.InvariantIDs) {
		return errors.New("420Search genesis profile cardinality drifted")
	}
	if len(m.CompletedPhases) != 22 || m.CompletedPhases[len(m.CompletedPhases)-1] != CloseoutPhase {
		return errors.New("420Search phase closeout incomplete")
	}
	return nil
}
