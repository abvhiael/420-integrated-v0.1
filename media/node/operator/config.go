package operator

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"strings"
	"time"

	medianode "github.com/420integrated/420-integrated/media/node"
)

var ErrInvalidConfig = errors.New("420media operator: invalid config")

type FileConfig struct {
	OperatorID     string   `json:"operator_id"`
	Capabilities   []string `json:"capabilities"`
	RPCURL         string   `json:"rpc_url"`
	MarketAddress  string   `json:"market_address"`
	CursorPath     string   `json:"cursor_path"`
	LeasePath      string   `json:"lease_path"`
	LeaseOwnerID   string   `json:"lease_owner_id"`
	SignerURL      string   `json:"signer_url"`
	SignerTokenEnv string   `json:"signer_token_env"`
	PollIntervalMS int64    `json:"poll_interval_ms"`
	LeaseTTLMS     int64    `json:"lease_ttl_ms"`
	MaxParallel    int      `json:"max_parallel"`
	StartBlock     uint64   `json:"start_block"`
}

type RuntimeConfig struct {
	Node           medianode.OperatorConfig
	RPCURL         string
	MarketAddress  string
	CursorPath     string
	LeasePath      string
	LeaseOwnerID   string
	SignerURL      string
	SignerTokenEnv string
	StartBlock     uint64
}

func LoadFile(path string) (RuntimeConfig, error) {
	if path == "" { return RuntimeConfig{}, ErrInvalidConfig }
	data, err := os.ReadFile(path)
	if err != nil { return RuntimeConfig{}, err }
	var fc FileConfig
	if err := json.Unmarshal(data, &fc); err != nil { return RuntimeConfig{}, err }
	return fc.Runtime()
}

func (c FileConfig) Runtime() (RuntimeConfig, error) {
	opID, err := parseBytes32(c.OperatorID)
	if err != nil || opID == ([32]byte{}) { return RuntimeConfig{}, ErrInvalidConfig }
	caps := make(map[[32]byte]struct{}, len(c.Capabilities))
	for _, raw := range c.Capabilities {
		id, err := parseBytes32(raw)
		if err != nil || id == ([32]byte{}) { return RuntimeConfig{}, ErrInvalidConfig }
		caps[id] = struct{}{}
	}
	if len(caps) == 0 || !validHTTPURL(c.RPCURL, false) || !validAddress(c.MarketAddress) || c.CursorPath == "" || c.LeasePath == "" || c.LeaseOwnerID == "" || !validHTTPURL(c.SignerURL, true) || c.SignerTokenEnv == "" {
		return RuntimeConfig{}, ErrInvalidConfig
	}
	if strings.ContainsAny(c.SignerTokenEnv, "= \t\r\n") { return RuntimeConfig{}, ErrInvalidConfig }
	poll := time.Duration(c.PollIntervalMS) * time.Millisecond
	lease := time.Duration(c.LeaseTTLMS) * time.Millisecond
	if poll <= 0 { poll = 2 * time.Second }
	if lease <= 0 { lease = 30 * time.Second }
	if c.MaxParallel <= 0 { c.MaxParallel = 1 }
	return RuntimeConfig{
		Node: medianode.OperatorConfig{OperatorID: opID, Capabilities: caps, PollInterval: poll, LeaseTTL: lease, MaxParallel: c.MaxParallel},
		RPCURL: c.RPCURL, MarketAddress: strings.ToLower(c.MarketAddress), CursorPath: c.CursorPath, LeasePath: c.LeasePath, LeaseOwnerID: c.LeaseOwnerID,
		SignerURL: c.SignerURL, SignerTokenEnv: c.SignerTokenEnv, StartBlock: c.StartBlock,
	}, nil
}

func Redacted(c RuntimeConfig) map[string]any {
	return map[string]any{
		"operator_id": "0x" + hex.EncodeToString(c.Node.OperatorID[:]),
		"capability_count": len(c.Node.Capabilities),
		"rpc_url": c.RPCURL,
		"market_address": c.MarketAddress,
		"cursor_path": c.CursorPath,
		"lease_path": c.LeasePath,
		"lease_owner_id": c.LeaseOwnerID,
		"signer_url": c.SignerURL,
		"signer_token_env": c.SignerTokenEnv,
		"poll_interval": c.Node.PollInterval.String(),
		"lease_ttl": c.Node.LeaseTTL.String(),
		"max_parallel": c.Node.MaxParallel,
		"start_block": c.StartBlock,
	}
}

func parseBytes32(v string) ([32]byte, error) {
	var out [32]byte
	if !strings.HasPrefix(v, "0x") || len(v) != 66 { return out, ErrInvalidConfig }
	b, err := hex.DecodeString(v[2:]); if err != nil || len(b) != 32 { return out, ErrInvalidConfig }
	copy(out[:], b); return out, nil
}

func validAddress(v string) bool {
	if !strings.HasPrefix(v, "0x") || len(v) != 42 { return false }
	_, err := hex.DecodeString(v[2:]); return err == nil
}

func validHTTPURL(raw string, signer bool) bool {
	u, err := url.Parse(raw); if err != nil || u.Host == "" || u.User != nil { return false }
	if u.Scheme == "https" { return true }
	if !signer || u.Scheme != "http" { return !signer && u.Scheme == "http" }
	host := strings.ToLower(u.Hostname())
	return host == "127.0.0.1" || host == "localhost" || host == "::1"
}
