package runtime

import (
	"errors"
	"fmt"
	"strings"
	"time"

	statussecurity "github.com/420integrated/420-integrated/status/security"
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
	if err := statussecurity.ValidateProbeURL(raw); err != nil { return fmt.Errorf("%s: %w", name, err) }
	return nil
}
