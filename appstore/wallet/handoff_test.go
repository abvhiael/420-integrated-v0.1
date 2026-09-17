package wallet

import (
    "errors"
    "strings"
    "testing"
)

func validRequest() Request {
    return Request{
        ChainID: 420,
        ServiceID: "420/service/example/v1",
        AppURL: "https://example.420/app",
        Action: "connect",
        RequiresConfirmation: true,
        Permissions: []Permission{{Name: "read-profile"}, {Name: "spend-token", HighRisk: true}},
        Capabilities: []CapabilityScope{{Capability: "messaging", Scope: "thread:123"}, {Capability: "payments", Scope: "token:420", HighRisk: true}},
    }
}

func TestBuildWalletHandoff(t *testing.T) {
    out, err := Build(validRequest())
    if err != nil { t.Fatal(err) }
    if !strings.HasPrefix(out.URI, "420wallet://open?") { t.Fatalf("unexpected uri: %s", out.URI) }
    if out.AuthorizationBoundary != "420Wallet/Smart Accounts" { t.Fatalf("unexpected boundary: %s", out.AuthorizationBoundary) }
    if !out.RequiresConfirmation { t.Fatal("expected wallet confirmation") }
    if len(out.HighRiskActions) != 2 { t.Fatalf("expected two high-risk disclosures, got %d", len(out.HighRiskActions)) }
}

func TestRejectsAuthorityEscalation(t *testing.T) {
    cases := []Request{
        func() Request { r := validRequest(); r.Signature = "0xdead"; return r }(),
        func() Request { r := validRequest(); r.PrivateKey = "secret"; return r }(),
        func() Request { r := validRequest(); r.GrantCapability = true; return r }(),
        func() Request { r := validRequest(); r.ApproveTokenSpend = true; return r }(),
        func() Request { r := validRequest(); r.AutoConfirm = true; return r }(),
        func() Request { r := validRequest(); r.RequiresConfirmation = false; return r }(),
    }
    for i, tc := range cases {
        if _, err := Build(tc); !errors.Is(err, ErrAuthorityEscalation) {
            t.Fatalf("case %d expected authority escalation error, got %v", i, err)
        }
    }
}

func TestRejectsInvalidDeepLinkInputs(t *testing.T) {
    cases := []Request{
        func() Request { r := validRequest(); r.ChainID = 0; return r }(),
        func() Request { r := validRequest(); r.ServiceID = ""; return r }(),
        func() Request { r := validRequest(); r.AppURL = "javascript:alert(1)"; return r }(),
        func() Request { r := validRequest(); r.Permissions = []Permission{{Name:""}}; return r }(),
        func() Request { r := validRequest(); r.Capabilities = []CapabilityScope{{Capability:"payments", Scope:""}}; return r }(),
    }
    for i, tc := range cases {
        if _, err := Build(tc); !errors.Is(err, ErrInvalidHandoff) {
            t.Fatalf("case %d expected invalid handoff, got %v", i, err)
        }
    }
}

func TestPresentationOrderingIsDeterministic(t *testing.T) {
    req := validRequest()
    req.Permissions = []Permission{{Name:"zeta"}, {Name:"alpha"}}
    req.Capabilities = []CapabilityScope{{Capability:"z", Scope:"2"}, {Capability:"a", Scope:"1"}}
    out, err := Build(req)
    if err != nil { t.Fatal(err) }
    if out.Permissions[0].Name != "alpha" || out.Capabilities[0].Capability != "a" {
        t.Fatal("presentation ordering is not deterministic")
    }
}
