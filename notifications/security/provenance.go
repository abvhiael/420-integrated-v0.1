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
	URL           string
	RequiresWallet bool
	CanSign       bool
	CanSpend      bool
	CanGrant      bool
	CanBypass     bool
}

var allowedSchemes = map[string]bool{
	"https": true,
	"http":  true,
	"wallet420": true,
	"420": true,
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
	u, err := url.Parse(raw)
	if err != nil { return nil, errors.New("invalid link") }
	scheme := strings.ToLower(u.Scheme)
	if !allowedSchemes[scheme] { return nil, errors.New("unsupported link scheme") }
	if scheme == "http" || scheme == "https" {
		if u.Hostname() == "" { return nil, errors.New("http link requires host") }
		if u.User != nil { return nil, errors.New("userinfo in link is forbidden") }
	}
	if strings.Contains(strings.ToLower(raw), "javascript:") || strings.Contains(strings.ToLower(raw), "data:") {
		return nil, errors.New("hostile link content")
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
