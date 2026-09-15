package runtime

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/discovery"
	"github.com/420integrated/420-integrated/search/httpapi"
	"github.com/420integrated/420-integrated/search/indexerclient"
	"github.com/420integrated/420-integrated/search/pagination"
	"github.com/420integrated/420-integrated/search/query"
	"github.com/420integrated/420-integrated/search/ranking"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

const RuntimeVersion = "420-search-runtime-v1"

type Reader interface {
	Qualified(context.Context) error
	Health(context.Context) (indexerclient.Health, error)
	Readiness(context.Context) (indexerclient.Readiness, error)
	Status(context.Context) (indexerclient.Status, error)
	Search(context.Context, string, uint32) ([]indexerclient.SearchResult, error)
	Block(context.Context, string) (indexerclient.Block, error)
	Transaction(context.Context, string) (indexerclient.Transaction, error)
	Address(context.Context, string) (indexerclient.Address, error)
	Services(context.Context) ([]indexerclient.ServiceSummary, error)
	Service(context.Context, string) (indexerclient.ServiceSummary, error)
	ServiceVersion(context.Context, string, uint32) (indexerclient.ServiceVersion, error)
	ProtocolState(context.Context, string, string) (indexerclient.ProtocolState, error)
	ProtocolEvents(context.Context, string, string, uint32) (indexerclient.ProtocolEventPage, error)
	AssetTransfers(context.Context, string, uint32) (indexerclient.AssetTransferPage, error)
}

type Service struct {
	reader Reader
	chain *discovery.ChainDiscovery
	registry *discovery.RegistryDiscovery
	namesIdentity *discovery.NamesIdentityDiscovery
	assetsValidators *discovery.AssetValidatorDiscovery
	publicEcosystem *discovery.PublicEcosystemDiscovery
}

func New(reader Reader, publicCommonsVisibility []string) (*Service, error) {
	if reader == nil { return nil, errors.New("search runtime reader required") }
	chain, err := discovery.NewChainDiscovery(reader)
	if err != nil { return nil, err }
	registry, err := discovery.NewRegistryDiscovery(reader)
	if err != nil { return nil, err }
	namesIdentity, err := discovery.NewNamesIdentityDiscovery(reader)
	if err != nil { return nil, err }
	assetsValidators, err := discovery.NewAssetValidatorDiscovery(reader)
	if err != nil { return nil, err }
	publicEcosystem, err := discovery.NewPublicEcosystemDiscovery(reader, publicCommonsVisibility)
	if err != nil { return nil, err }
	return &Service{reader:reader, chain:chain, registry:registry, namesIdentity:namesIdentity, assetsValidators:assetsValidators, publicEcosystem:publicEcosystem}, nil
}

func (s *Service) Search(ctx context.Context, req httpapi.SearchRequest) (httpapi.SearchResponse, error) {
	candidates, err := s.candidates(ctx, req.Plan)
	if err != nil { return httpapi.SearchResponse{}, publicBackendError(err) }
	ranked, err := ranking.Rank(req.Plan, candidates)
	if err != nil { return httpapi.SearchResponse{}, err }
	snapshot, err := s.snapshot(ctx)
	if err != nil { return httpapi.SearchResponse{}, publicBackendError(err) }
	page, err := pagination.Paginate(req.Plan, ranked, snapshot, req.Limit, req.Cursor)
	if err != nil { return httpapi.SearchResponse{}, &httpapi.StatusError{Status:409, Code:"snapshot_changed", Err:err} }
	return httpapi.SearchResponse{Results:page.Items, Snapshot:page.Snapshot, NextCursor:page.NextCursor}, nil
}

func (s *Service) Suggest(ctx context.Context, req httpapi.SuggestRequest) ([]httpapi.Suggestion, error) {
	if err := s.reader.Qualified(ctx); err != nil { return nil, publicBackendError(err) }
	matches, err := s.reader.Search(ctx, req.Query, uint32(req.Limit))
	if err != nil { return nil, publicBackendError(err) }
	out := make([]httpapi.Suggestion, 0, len(matches))
	seen := map[string]struct{}{}
	for _, match := range matches {
		text := strings.TrimSpace(match.Value)
		if text == "" { text = strings.TrimSpace(match.Key) }
		if text == "" { continue }
		key := strings.ToLower(text)
		if _, ok := seen[key]; ok { continue }
		seen[key] = struct{}{}
		out = append(out, httpapi.Suggestion{Text:text, Domain:domainForIndexerType(match.Type)})
		if len(out) >= req.Limit { break }
	}
	return out, nil
}

func (s *Service) Resolve(ctx context.Context, req httpapi.ResolveRequest) (httpapi.ResolveResponse, error) {
	candidates, err := s.candidates(ctx, req.Plan)
	if err != nil { return httpapi.ResolveResponse{}, publicBackendError(err) }
	ranked, err := ranking.Rank(req.Plan, candidates)
	if err != nil { return httpapi.ResolveResponse{}, err }
	if len(ranked) == 0 { return httpapi.ResolveResponse{}, nil }
	return httpapi.ResolveResponse{Result:&ranked[0]}, nil
}

func (s *Service) Health(ctx context.Context) (httpapi.OperationalStatus, error) {
	if _, err := s.reader.Health(ctx); err != nil { return degraded("indexer health unavailable"), nil }
	return s.operational(ctx)
}

func (s *Service) Readiness(ctx context.Context) (httpapi.OperationalStatus, error) {
	if _, err := s.reader.Readiness(ctx); err != nil { return degraded(classifyReason(err)), nil }
	return s.operational(ctx)
}

func (s *Service) Status(ctx context.Context) (httpapi.OperationalStatus, error) { return s.operational(ctx) }

func (s *Service) operational(ctx context.Context) (httpapi.OperationalStatus, error) {
	status, err := s.reader.Status(ctx)
	if err != nil { return degraded(classifyReason(err)), nil }
	indexed, err := parseHeight(status.IndexedHead)
	if err != nil { return degraded("invalid indexed height"), nil }
	finalized, err := parseHeight(status.Finality.SafeHead)
	if err != nil { return degraded("invalid finality height"), nil }
	if finalized > indexed { return degraded("finality height exceeds indexed height"), nil }
	return httpapi.OperationalStatus{OK:true, State:"ready", IndexedHeight:indexed, FinalizedHeight:finalized}, nil
}

func (s *Service) snapshot(ctx context.Context) (pagination.Snapshot, error) {
	status, err := s.reader.Status(ctx)
	if err != nil { return pagination.Snapshot{}, err }
	indexed, err := parseHeight(status.IndexedHead)
	if err != nil || indexed == 0 { return pagination.Snapshot{}, errors.New("qualified indexed height required") }
	finalized, err := parseHeight(status.Finality.SafeHead)
	if err != nil { return pagination.Snapshot{}, err }
	if finalized > indexed { return pagination.Snapshot{}, errors.New("finalized height exceeds indexed height") }
	return pagination.Snapshot{IndexedHeight:indexed, FinalizedHeight:finalized}, nil
}

func (s *Service) candidates(ctx context.Context, plan query.Plan) ([]searchresult.Result, error) {
	if plan.Schema != query.SchemaVersion { return nil, errors.New("unsupported query schema") }
	switch plan.Kind {
	case query.KindText:
		chain, err := s.chain.Resolve(ctx, plan.Normalized)
		if err != nil { return nil, err }
		registry, err := s.registry.Discover(ctx, plan.Normalized)
		if err != nil { return nil, err }
		return append(chain, registry...), nil
	case query.KindBlockNumber, query.KindHash, query.KindAddress:
		return s.chain.Resolve(ctx, plan.ExactValue)
	case query.KindTypedExact:
		return s.typedExact(ctx, plan.TargetDomain, plan.ExactValue)
	case query.KindProtocolObject:
		return s.protocolObject(ctx, plan.Protocol, plan.ObjectKey)
	default:
		return nil, errors.New("unsupported query kind")
	}
}

func (s *Service) typedExact(ctx context.Context, domain architecture.ResultDomain, value string) ([]searchresult.Result, error) {
	switch domain {
	case architecture.DomainBlock, architecture.DomainTransaction, architecture.DomainAddress, architecture.DomainContract:
		results, err := s.chain.Resolve(ctx, value)
		if err != nil { return nil, err }
		return onlyDomain(results, domain), nil
	case architecture.DomainService:
		r, err := s.registry.ResolveService(ctx, value)
		if err != nil { return nil, err }
		return []searchresult.Result{r}, nil
	case architecture.DomainName:
		r, ok, err := s.namesIdentity.ResolveName(ctx, value)
		if err != nil || !ok { return nil, err }
		return []searchresult.Result{r}, nil
	case architecture.DomainPublicIdentity:
		r, ok, err := s.namesIdentity.ResolvePublicIdentity(ctx, value)
		if err != nil || !ok { return nil, err }
		return []searchresult.Result{r}, nil
	case architecture.DomainAsset:
		return s.assetsValidators.ResolveAsset(ctx, value)
	case architecture.DomainValidator:
		return s.assetsValidators.ResolveValidator(ctx, value)
	case architecture.DomainMarketListing:
		return s.publicEcosystem.ResolveMarketListing(ctx, value)
	case architecture.DomainRightsRecord:
		return s.publicEcosystem.ResolveRightsRecord(ctx, value)
	case architecture.DomainPublicCommons:
		return s.publicEcosystem.ResolvePublicCommons(ctx, value)
	case architecture.DomainPublicPulse:
		return s.publicEcosystem.ResolvePublicPulse(ctx, value)
	default:
		return nil, errors.New("unsupported exact result domain")
	}
}

func (s *Service) protocolObject(ctx context.Context, protocol, objectKey string) ([]searchresult.Result, error) {
	switch strings.ToLower(strings.TrimSpace(protocol)) {
	case "420names": return s.typedExact(ctx, architecture.DomainName, objectKey)
	case "420identity": return s.typedExact(ctx, architecture.DomainPublicIdentity, objectKey)
	case "420stake": return s.typedExact(ctx, architecture.DomainValidator, objectKey)
	case "420market": return s.typedExact(ctx, architecture.DomainMarketListing, objectKey)
	case "420rights": return s.typedExact(ctx, architecture.DomainRightsRecord, objectKey)
	case "420commons": return s.typedExact(ctx, architecture.DomainPublicCommons, objectKey)
	case "420pulse": return s.typedExact(ctx, architecture.DomainPublicPulse, objectKey)
	default:
		return s.chain.Resolve(ctx, protocol+":"+objectKey)
	}
}

func onlyDomain(in []searchresult.Result, domain architecture.ResultDomain) []searchresult.Result {
	out := make([]searchresult.Result, 0, len(in))
	for _, item := range in { if item.Domain == domain { out = append(out, item) } }
	return out
}

func domainForIndexerType(value string) architecture.ResultDomain {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "block": return architecture.DomainBlock
	case "transaction": return architecture.DomainTransaction
	case "address": return architecture.DomainAddress
	case "contract": return architecture.DomainContract
	default: return ""
	}
}

func parseHeight(value string) (uint64, error) {
	value = strings.TrimSpace(value)
	if value == "" { return 0, nil }
	return strconv.ParseUint(value, 10, 64)
}

func degraded(reason string) httpapi.OperationalStatus { return httpapi.OperationalStatus{OK:false, State:"degraded", Reason:reason} }

func classifyReason(err error) string {
	switch {
	case errors.Is(err, indexerclient.ErrWrongChain): return "wrong chain"
	case errors.Is(err, indexerclient.ErrIndexerNotReady): return "indexer not ready"
	case errors.Is(err, indexerclient.ErrIndexerStale): return "indexer stale"
	case errors.Is(err, indexerclient.ErrIndexerAuthoritative): return "indexer authority contract invalid"
	default: return "indexer unavailable"
	}
}

func publicBackendError(err error) error {
	if err == nil { return nil }
	code := "backend_unavailable"
	status := 503
	switch {
	case errors.Is(err, indexerclient.ErrWrongChain): code = "wrong_chain"
	case errors.Is(err, indexerclient.ErrIndexerStale): code = "indexer_stale"
	case errors.Is(err, indexerclient.ErrIndexerNotReady): code = "indexer_not_ready"
	case errors.Is(err, indexerclient.ErrIndexerAuthoritative): code = "invalid_authority"
	}
	return &httpapi.StatusError{Status:status, Code:code, Err:fmt.Errorf("%s", code)}
}
