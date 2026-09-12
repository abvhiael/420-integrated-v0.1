package architecture

const (
	ServiceName = "420Search"
	ServiceID   = "420/service/search/v1"
	Phase       = "SEARCH-0"

	IndexerConsumerQualification = "QUALIFIED_INDEXER_API_CONSUMER"
)

type SearchMode string

const (
	SearchModeResolver  SearchMode = "resolver"
	SearchModeDiscovery SearchMode = "discovery"
)

type ResultDomain string

const (
	DomainBlock            ResultDomain = "block"
	DomainTransaction      ResultDomain = "transaction"
	DomainAddress          ResultDomain = "address"
	DomainContract         ResultDomain = "contract"
	DomainService          ResultDomain = "service"
	DomainName             ResultDomain = "name"
	DomainPublicIdentity   ResultDomain = "public_identity"
	DomainAsset            ResultDomain = "asset"
	DomainValidator        ResultDomain = "validator"
	DomainMarketListing    ResultDomain = "market_listing"
	DomainRightsRecord     ResultDomain = "rights_record"
	DomainPublicCommons    ResultDomain = "public_commons"
	DomainPublicPulse      ResultDomain = "public_pulse"
)

type SourceBoundary string

const (
	SourceIndexer      SourceBoundary = "420Indexer"
	SourceRegistry     SourceBoundary = "420Registry"
	SourceNames        SourceBoundary = "420Names"
	SourceIdentity     SourceBoundary = "420Identity:public"
	SourceMarket       SourceBoundary = "420Market:public"
	SourceRights       SourceBoundary = "420Rights:public"
	SourceCommons      SourceBoundary = "420Commons:public"
	SourcePulse        SourceBoundary = "420Pulse:public"
)

type PrivacyExclusion string

const (
	ExcludePrivateMessenger PrivacyExclusion = "private_messenger"
	ExcludePrivateCommons   PrivacyExclusion = "private_commons"
	ExcludePrivateIdentity  PrivacyExclusion = "private_identity"
	ExcludeEncryptedResource PrivacyExclusion = "encrypted_resource_payload"
	ExcludeRawAttention     PrivacyExclusion = "raw_attention_telemetry"
)

var GenesisDomains = []ResultDomain{
	DomainBlock,
	DomainTransaction,
	DomainAddress,
	DomainContract,
	DomainService,
	DomainName,
	DomainPublicIdentity,
	DomainAsset,
	DomainValidator,
	DomainMarketListing,
	DomainRightsRecord,
	DomainPublicCommons,
	DomainPublicPulse,
}

var PrivacyExclusions = []PrivacyExclusion{
	ExcludePrivateMessenger,
	ExcludePrivateCommons,
	ExcludePrivateIdentity,
	ExcludeEncryptedResource,
	ExcludeRawAttention,
}

var InvariantIDs = []string{
	"SRCH-INV-001",
	"SRCH-INV-002",
	"SRCH-INV-003",
	"SRCH-INV-004",
	"SRCH-INV-005",
	"SRCH-INV-006",
	"SRCH-INV-007",
	"SRCH-INV-008",
	"SRCH-INV-009",
	"SRCH-INV-010",
	"SRCH-INV-011",
	"SRCH-INV-012",
}

type Profile struct {
	ServiceName                  string
	ServiceID                    string
	Phase                        string
	ContractsRequired            bool
	CanonicalStateAuthority      bool
	SearchOwnsChainIngestion     bool
	SearchMayUseDirectRPC        bool
	SearchDatabaseCanonical      bool
	SearchIndexRebuildable       bool
	RankingCanonical             bool
	SponsoredMayRewriteCanonical bool
	Modes                        []SearchMode
	Domains                      []ResultDomain
	PrivacyExclusions            []PrivacyExclusion
	InvariantIDs                 []string
}

func GenesisProfile() Profile {
	return Profile{
		ServiceName:                  ServiceName,
		ServiceID:                    ServiceID,
		Phase:                        Phase,
		ContractsRequired:            false,
		CanonicalStateAuthority:      false,
		SearchOwnsChainIngestion:     false,
		SearchMayUseDirectRPC:        false,
		SearchDatabaseCanonical:      false,
		SearchIndexRebuildable:       true,
		RankingCanonical:             false,
		SponsoredMayRewriteCanonical: false,
		Modes:                        []SearchMode{SearchModeResolver, SearchModeDiscovery},
		Domains:                      append([]ResultDomain(nil), GenesisDomains...),
		PrivacyExclusions:            append([]PrivacyExclusion(nil), PrivacyExclusions...),
		InvariantIDs:                 append([]string(nil), InvariantIDs...),
	}
}
