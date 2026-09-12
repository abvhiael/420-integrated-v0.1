package query

import (
	"errors"
	"regexp"
	"sort"
	"strings"

	"github.com/420integrated/420-integrated/search/architecture"
)

const SchemaVersion = "420-search-query-v1"

// Kind identifies how a normalized user query should be routed before ranking.
type Kind string

const (
	KindText           Kind = "text"
	KindBlockNumber    Kind = "block_number"
	KindHash           Kind = "hash"
	KindAddress        Kind = "address"
	KindProtocolObject Kind = "protocol_object"
	KindTypedExact     Kind = "typed_exact"
)

type Plan struct {
	Schema       string                      `json:"schema"`
	Raw          string                      `json:"raw"`
	Normalized   string                      `json:"normalized"`
	Kind         Kind                        `json:"kind"`
	ExactValue   string                      `json:"exactValue,omitempty"`
	Protocol     string                      `json:"protocol,omitempty"`
	ObjectKey    string                      `json:"objectKey,omitempty"`
	TargetDomain architecture.ResultDomain   `json:"targetDomain,omitempty"`
	Domains      []architecture.ResultDomain `json:"domains,omitempty"`
}

var (
	hex40RE          = regexp.MustCompile(`^0x[0-9a-f]{40}$`)
	hex64RE          = regexp.MustCompile(`^0x[0-9a-f]{64}$`)
	decimalRE        = regexp.MustCompile(`^[0-9]+$`)
	protocolObjectRE = regexp.MustCompile(`^([a-z0-9][a-z0-9_-]*):([^\s]+)$`)
)

var domainAliases = map[string]architecture.ResultDomain{
	"block": architecture.DomainBlock,
	"blocks": architecture.DomainBlock,
	"transaction": architecture.DomainTransaction,
	"transactions": architecture.DomainTransaction,
	"tx": architecture.DomainTransaction,
	"address": architecture.DomainAddress,
	"addresses": architecture.DomainAddress,
	"contract": architecture.DomainContract,
	"contracts": architecture.DomainContract,
	"service": architecture.DomainService,
	"services": architecture.DomainService,
	"app": architecture.DomainService,
	"apps": architecture.DomainService,
	"name": architecture.DomainName,
	"names": architecture.DomainName,
	"identity": architecture.DomainPublicIdentity,
	"identities": architecture.DomainPublicIdentity,
	"profile": architecture.DomainPublicIdentity,
	"profiles": architecture.DomainPublicIdentity,
	"asset": architecture.DomainAsset,
	"assets": architecture.DomainAsset,
	"validator": architecture.DomainValidator,
	"validators": architecture.DomainValidator,
	"market": architecture.DomainMarketListing,
	"listing": architecture.DomainMarketListing,
	"listings": architecture.DomainMarketListing,
	"rights": architecture.DomainRightsRecord,
	"right": architecture.DomainRightsRecord,
	"commons": architecture.DomainPublicCommons,
	"space": architecture.DomainPublicCommons,
	"spaces": architecture.DomainPublicCommons,
	"pulse": architecture.DomainPublicPulse,
	"publication": architecture.DomainPublicPulse,
	"publications": architecture.DomainPublicPulse,
}

// typedPrefixes intentionally cover canonical result domains only. "domain:" is
// reserved for non-canonical filtering and "protocol:key" remains an Indexer
// protocol-object resolver primitive.
var typedPrefixes = map[string]architecture.ResultDomain{
	"block": architecture.DomainBlock,
	"tx": architecture.DomainTransaction,
	"transaction": architecture.DomainTransaction,
	"address": architecture.DomainAddress,
	"contract": architecture.DomainContract,
	"service": architecture.DomainService,
	"name": architecture.DomainName,
	"identity": architecture.DomainPublicIdentity,
	"profile": architecture.DomainPublicIdentity,
	"asset": architecture.DomainAsset,
	"validator": architecture.DomainValidator,
	"market": architecture.DomainMarketListing,
	"listing": architecture.DomainMarketListing,
	"rights": architecture.DomainRightsRecord,
	"commons": architecture.DomainPublicCommons,
	"space": architecture.DomainPublicCommons,
	"pulse": architecture.DomainPublicPulse,
	"publication": architecture.DomainPublicPulse,
}

func Parse(raw string) (Plan, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return Plan{}, errors.New("search query required")
	}

	term := trimmed
	var domains []architecture.ResultDomain
	var err error
	if strings.Contains(strings.ToLower(trimmed), "domain:") {
		term, domains, err = extractDomainFilters(trimmed)
		if err != nil {
			return Plan{}, err
		}
	}
	if term == "" {
		return Plan{}, errors.New("search term required after domain filter")
	}

	normalized := strings.ToLower(strings.TrimSpace(term))
	plan := Plan{
		Schema: SchemaVersion,
		Raw: trimmed,
		Normalized: normalized,
		Kind: KindText,
		Domains: domains,
	}

	if domain, value, ok := parseTypedPrefix(normalized); ok {
		plan.Kind = KindTypedExact
		plan.TargetDomain = domain
		plan.ExactValue = value
		return plan, nil
	}

	switch {
	case decimalRE.MatchString(normalized):
		plan.Kind = KindBlockNumber
		plan.ExactValue = normalized
		plan.TargetDomain = architecture.DomainBlock
	case hex40RE.MatchString(normalized):
		plan.Kind = KindAddress
		plan.ExactValue = normalized
	case hex64RE.MatchString(normalized):
		plan.Kind = KindHash
		plan.ExactValue = normalized
	case protocolObjectRE.MatchString(normalized):
		m := protocolObjectRE.FindStringSubmatch(normalized)
		plan.Kind = KindProtocolObject
		plan.ExactValue = normalized
		plan.Protocol = m[1]
		plan.ObjectKey = m[2]
	default:
		plan.Kind = KindText
	}
	return plan, nil
}

func parseTypedPrefix(normalized string) (architecture.ResultDomain, string, bool) {
	idx := strings.IndexByte(normalized, ':')
	if idx <= 0 || idx == len(normalized)-1 {
		return "", "", false
	}
	prefix := strings.TrimSpace(normalized[:idx])
	if prefix == "domain" {
		return "", "", false
	}
	domain, ok := typedPrefixes[prefix]
	if !ok {
		return "", "", false
	}
	value := strings.TrimSpace(normalized[idx+1:])
	if value == "" || strings.ContainsAny(value, "\r\n\t") {
		return "", "", false
	}
	return domain, value, true
}

func extractDomainFilters(raw string) (string, []architecture.ResultDomain, error) {
	fields := strings.Fields(raw)
	remaining := make([]string, 0, len(fields))
	set := make(map[architecture.ResultDomain]struct{})
	for _, field := range fields {
		if !strings.HasPrefix(strings.ToLower(field), "domain:") {
			remaining = append(remaining, field)
			continue
		}
		value := strings.TrimSpace(field[len("domain:"):])
		if value == "" {
			return "", nil, errors.New("empty domain filter")
		}
		for _, token := range strings.Split(value, ",") {
			alias := strings.ToLower(strings.TrimSpace(token))
			domain, ok := domainAliases[alias]
			if !ok {
				return "", nil, errors.New("unsupported domain filter: " + alias)
			}
			set[domain] = struct{}{}
		}
	}

	domains := make([]architecture.ResultDomain, 0, len(set))
	for domain := range set {
		domains = append(domains, domain)
	}
	sort.Slice(domains, func(i, j int) bool { return domains[i] < domains[j] })
	return strings.TrimSpace(strings.Join(remaining, " ")), domains, nil
}
