package security

import (
	"errors"
	"net/url"
	"strings"
)

type Provenance struct {
	ChainID         string
	BlockNumber     string
	BlockHash       string
	TransactionHash string
	LogIndex        int
	SourceID        string
	OriginURL       string
}

type Handoff struct {
	URL            string
	RequiresWallet bool
	CanSign        bool
	CanSpend       bool
	CanGrant       bool
	CanBypass      bool
}

var allowedSchemes = map[string]bool{
	"https":     true,
	"http":      true,
	"wallet420": true,
	"420":       true,
}

func ValidateProvenance(p Provenance) error {
	if strings.TrimSpace(p.ChainID) == "" { return errors.New("chain id is required") }
	if strings.TrimSpace(p.SourceID) == "" { return errors.New("source id is required") }
	if strings.TrimSpace(p.BlockNumber) == "" || strings.TrimSpace(p.BlockHash) == "" { return errors.New("block provenance is required") }
	if strings.TrimSpace(p.TransactionHash) == "" { return errors.New("transaction hash is required") }
	if p.LogIndex < 0 { return errors.New("log index must be non-negative") }
	if _, err := ValidateLink(p.OriginURL); err != nil { return err }
	return nil
}

func ValidateLink(raw string) (*url.URL, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" { return nil, errors.New("link is required") }

	lower := strings.ToLower(raw)
	if strings.Contains(lower, "javascript:") || strings.Contains(lower, "data:") {
		return nil, errors.New("hostile link content")
	}

	// net/url follows RFC 3986 and rejects schemes beginning with a digit.
	// 420 Integrated intentionally uses the application handoff form 420://..., so
	// parse it through a temporary alphabetic scheme and restore the canonical one.
	parseTarget := raw
	is420 := strings.HasPrefix(lower, "420://")
	if is420 {
		if len(raw) <= len("420://") { return nil, errors.New("invalid link") }
		parseTarget = "app420://" + raw[len("420://"):]
	}

	u, err := url.Parse(parseTarget)
	if err != nil { return nil, errors.New("invalid link") }
	if is420 { u.Scheme = "420" }

	scheme := strings.ToLower(u.Scheme)
	if !allowedSchemes[scheme] { return nil, errors.New("unsupported link scheme") }

	if scheme == "http" || scheme == "https" {
		if u.Hostname() == "" { return nil, errors.New("http link requires host") }
		if u.User != nil { return nil, errors.New("userinfo in link is forbidden") }
	}

	if scheme == "420" || scheme == "wallet420" {
		if u.Host == "" { return nil, errors.New("application handoff requires target") }
		if u.User != nil { return nil, errors.New("userinfo in link is forbidden") }
	}

	return u, nil
}

func ValidateHandoff(h Handoff) error {
	if _, err := ValidateLink(h.URL); err != nil { return err }
	if h.CanSign || h.CanSpend || h.CanGrant || h.CanBypass {
		return errors.New("notification handoff cannot carry authority")
	}
	return nil
}
