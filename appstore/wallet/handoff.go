package wallet

import (
    "errors"
    "fmt"
    "net/url"
    "sort"
    "strconv"
    "strings"
)

var (
    ErrInvalidHandoff = errors.New("invalid wallet handoff")
    ErrAuthorityEscalation = errors.New("appstore handoff cannot grant or exercise authority")
)

type Permission struct {
    Name        string `json:"name"`
    Description string `json:"description,omitempty"`
    HighRisk    bool   `json:"highRisk"`
}

type CapabilityScope struct {
    Capability string `json:"capability"`
    Scope      string `json:"scope"`
    HighRisk   bool   `json:"highRisk"`
}

type Request struct {
    ChainID       uint64            `json:"chainId"`
    ServiceID     string            `json:"serviceId"`
    AppURL        string            `json:"appUrl"`
    Action        string            `json:"action,omitempty"`
    Permissions   []Permission      `json:"permissions,omitempty"`
    Capabilities  []CapabilityScope `json:"capabilities,omitempty"`
    RequiresConfirmation bool       `json:"requiresConfirmation"`

    // These fields are forbidden in AppStore-generated handoffs. They are
    // intentionally modeled so attempts to smuggle authority are rejected.
    Signature         string `json:"signature,omitempty"`
    PrivateKey        string `json:"privateKey,omitempty"`
    GrantCapability   bool   `json:"grantCapability,omitempty"`
    ApproveTokenSpend bool   `json:"approveTokenSpend,omitempty"`
    AutoConfirm       bool   `json:"autoConfirm,omitempty"`
}

type Presentation struct {
    URI               string            `json:"uri"`
    Permissions       []Permission      `json:"permissions,omitempty"`
    Capabilities      []CapabilityScope `json:"capabilities,omitempty"`
    HighRiskActions   []string          `json:"highRiskActions,omitempty"`
    RequiresConfirmation bool           `json:"requiresConfirmation"`
    AuthorizationBoundary string        `json:"authorizationBoundary"`
}

func Build(req Request) (Presentation, error) {
    if req.ChainID == 0 || strings.TrimSpace(req.ServiceID) == "" {
        return Presentation{}, ErrInvalidHandoff
    }
    app, err := url.Parse(strings.TrimSpace(req.AppURL))
    if err != nil || app.Scheme == "" || app.Host == "" || (app.Scheme != "https" && app.Scheme != "http") {
        return Presentation{}, ErrInvalidHandoff
    }
    if req.Signature != "" || req.PrivateKey != "" || req.GrantCapability || req.ApproveTokenSpend || req.AutoConfirm {
        return Presentation{}, ErrAuthorityEscalation
    }
    // Any action-bearing launch requires Wallet/Smart Account confirmation.
    if strings.TrimSpace(req.Action) != "" && !req.RequiresConfirmation {
        return Presentation{}, ErrAuthorityEscalation
    }

    perms := append([]Permission(nil), req.Permissions...)
    caps := append([]CapabilityScope(nil), req.Capabilities...)
    sort.Slice(perms, func(i, j int) bool { return strings.ToLower(perms[i].Name) < strings.ToLower(perms[j].Name) })
    sort.Slice(caps, func(i, j int) bool {
        a := strings.ToLower(caps[i].Capability + ":" + caps[i].Scope)
        b := strings.ToLower(caps[j].Capability + ":" + caps[j].Scope)
        return a < b
    })

    risk := make([]string, 0)
    for _, p := range perms {
        if strings.TrimSpace(p.Name) == "" { return Presentation{}, ErrInvalidHandoff }
        if p.HighRisk { risk = append(risk, "permission:"+p.Name) }
    }
    for _, c := range caps {
        if strings.TrimSpace(c.Capability) == "" || strings.TrimSpace(c.Scope) == "" { return Presentation{}, ErrInvalidHandoff }
        if c.HighRisk { risk = append(risk, "capability:"+c.Capability+"@"+c.Scope) }
    }
    sort.Strings(risk)

    q := url.Values{}
    q.Set("chainId", strconv.FormatUint(req.ChainID, 10))
    q.Set("serviceId", req.ServiceID)
    q.Set("appUrl", app.String())
    if action := strings.TrimSpace(req.Action); action != "" { q.Set("action", action) }
    q.Set("confirm", strconv.FormatBool(req.RequiresConfirmation))

    uri := fmt.Sprintf("420wallet://open?%s", q.Encode())
    return Presentation{
        URI: uri,
        Permissions: perms,
        Capabilities: caps,
        HighRiskActions: risk,
        RequiresConfirmation: req.RequiresConfirmation,
        AuthorizationBoundary: "420Wallet/Smart Accounts",
    }, nil
}
