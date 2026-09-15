package query

import (
	"reflect"
	"testing"

	"github.com/420integrated/420-integrated/search/architecture"
)

func TestParseExactPrimitives(t *testing.T) {
	tests := []struct {
		name string
		in string
		kind Kind
		domain architecture.ResultDomain
		value string
	}{
		{"block", " 420 ", KindBlockNumber, architecture.DomainBlock, "420"},
		{"address", "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", KindAddress, "", "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
		{"hash", "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", KindHash, "", "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			plan, err := Parse(tt.in)
			if err != nil { t.Fatal(err) }
			if plan.Kind != tt.kind { t.Fatalf("kind = %q, want %q", plan.Kind, tt.kind) }
			if plan.TargetDomain != tt.domain { t.Fatalf("domain = %q, want %q", plan.TargetDomain, tt.domain) }
			if plan.ExactValue != tt.value { t.Fatalf("exact = %q, want %q", plan.ExactValue, tt.value) }
		})
	}
}

func TestParseProtocolObject(t *testing.T) {
	plan, err := Parse("420Registry:service-key")
	if err != nil { t.Fatal(err) }
	if plan.Kind != KindProtocolObject { t.Fatalf("kind = %q", plan.Kind) }
	if plan.Protocol != "420registry" || plan.ObjectKey != "service-key" { t.Fatalf("unexpected protocol route: %#v", plan) }
}

func TestParseTypedExactDomain(t *testing.T) {
	plan, err := Parse("validator:0xABCDEF")
	if err != nil { t.Fatal(err) }
	if plan.Kind != KindTypedExact { t.Fatalf("kind = %q", plan.Kind) }
	if plan.TargetDomain != architecture.DomainValidator { t.Fatalf("domain = %q", plan.TargetDomain) }
	if plan.ExactValue != "0xabcdef" { t.Fatalf("exact = %q", plan.ExactValue) }
}

func TestParseDomainFiltersAreDeterministicAndNonCanonical(t *testing.T) {
	plan, err := Parse("domain:validators,assets domain:asset   kush")
	if err != nil { t.Fatal(err) }
	want := []architecture.ResultDomain{architecture.DomainAsset, architecture.DomainValidator}
	if !reflect.DeepEqual(plan.Domains, want) { t.Fatalf("domains = %#v, want %#v", plan.Domains, want) }
	if plan.Kind != KindText || plan.Normalized != "kush" { t.Fatalf("unexpected text plan: %#v", plan) }
	if plan.TargetDomain != "" { t.Fatalf("filter must not become canonical target domain: %q", plan.TargetDomain) }
}

func TestParseDomainAliases(t *testing.T) {
	plan, err := Parse("domain:tx,profiles,listings,spaces,publications query")
	if err != nil { t.Fatal(err) }
	want := []architecture.ResultDomain{
		architecture.DomainMarketListing,
		architecture.DomainPublicCommons,
		architecture.DomainPublicIdentity,
		architecture.DomainPublicPulse,
		architecture.DomainTransaction,
	}
	if !reflect.DeepEqual(plan.Domains, want) { t.Fatalf("domains = %#v, want %#v", plan.Domains, want) }
}

func TestParseRejectsInvalidInput(t *testing.T) {
	for _, in := range []string{"", "   ", "domain:", "domain:private hello", "domain:assets"} {
		t.Run(in, func(t *testing.T) {
			if _, err := Parse(in); err == nil { t.Fatalf("expected error for %q", in) }
		})
	}
}

func TestUnknownColonExpressionRemainsProtocolObjectWhenValid(t *testing.T) {
	plan, err := Parse("custom_protocol:object-42")
	if err != nil { t.Fatal(err) }
	if plan.Kind != KindProtocolObject { t.Fatalf("kind = %q", plan.Kind) }
	if plan.Protocol != "custom_protocol" || plan.ObjectKey != "object-42" { t.Fatalf("unexpected plan: %#v", plan) }
}

func TestFreeTextNormalization(t *testing.T) {
	plan, err := Parse("   High   Country   Seeds   ")
	if err != nil { t.Fatal(err) }
	if plan.Schema != SchemaVersion { t.Fatalf("schema = %q", plan.Schema) }
	if plan.Kind != KindText { t.Fatalf("kind = %q", plan.Kind) }
	if plan.Normalized != "high   country   seeds" { t.Fatalf("normalized = %q", plan.Normalized) }
	if plan.Raw != "High   Country   Seeds" { t.Fatalf("raw = %q", plan.Raw) }
}
