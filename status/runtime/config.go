package runtime

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

type Config struct {
	ChainID        uint64
	IndexerURL     string
	ListenAddr     string
	RequestTimeout time.Duration
	MaxEvidenceAge time.Duration
}

func (c Config) Validate() error {
	if c.ChainID == 0 { return errors.New("chain id must be non-zero") }
	if err := requireURL("indexer url", c.IndexerURL); err != nil { return err }
	if strings.TrimSpace(c.ListenAddr) == "" { return errors.New("listen address is required") }
	if c.RequestTimeout <= 0 { return errors.New("request timeout must be positive") }
	if c.MaxEvidenceAge <= 0 { return errors.New("max evidence age must be positive") }
	return nil
}

func requireURL(name, raw string) error {
	if strings.TrimSpace(raw) == "" { return fmt.Errorf("%s is required", name) }
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" { return fmt.Errorf("%s must be an absolute URL", name) }
	if u.Scheme != "http" && u.Scheme != "https" { return fmt.Errorf("%s must use http or https", name) }
	return nil
}
