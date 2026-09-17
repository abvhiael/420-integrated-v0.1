package hardening

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"unicode"
)

var excludedSourcePrefixes = []string{
	"420/service/messenger/private",
	"420/service/commons/private",
	"420/service/resource/encrypted",
	"420/service/identity/private",
	"420/service/attention/raw",
}

// DeliveryEndpointKey derives a stable, opaque key for provider-local abuse
// controls without retaining a raw wallet-address-to-endpoint correlation key.
func DeliveryEndpointKey(provider, destination string) (string, error) {
	provider = strings.ToLower(strings.TrimSpace(provider))
	destination = strings.TrimSpace(destination)
	if provider == "" || destination == "" {
		return "", errors.New("provider and destination are required")
	}
	sum := sha256.Sum256([]byte(provider + "\x00" + destination))
	return provider + ":" + hex.EncodeToString(sum[:16]), nil
}

func ValidateSource(sourceID string) error {
	source := strings.ToLower(strings.TrimSpace(sourceID))
	if source == "" { return errors.New("source id is required") }
	for _, prefix := range excludedSourcePrefixes {
		if source == prefix || strings.HasPrefix(source, prefix+"/") {
			return errors.New("private source is excluded from notifications")
		}
	}
	return nil
}

// SanitizeMetadata rejects control characters and bounds attacker-controlled
// presentation metadata. Canonical protocol data must remain available through
// its source; this sanitization applies only to notification presentation data.
func SanitizeMetadata(value string, maxRunes int) (string, error) {
	value = strings.TrimSpace(value)
	if maxRunes < 1 { return "", errors.New("metadata limit must be positive") }
	for _, r := range value {
		if unicode.IsControl(r) { return "", errors.New("metadata contains control characters") }
	}
	if len([]rune(value)) > maxRunes { return "", errors.New("metadata exceeds limit") }
	return value, nil
}

type Mode string

const (
	ModeNormal   Mode = "normal"
	ModeDegraded Mode = "degraded"
)

type Health struct {
	Mode          Mode
	ProviderReady bool
	IndexerReady  bool
	Canonical     bool
}

func EvaluateHealth(providerReady, indexerReady bool) Health {
	mode := ModeNormal
	if !providerReady || !indexerReady { mode = ModeDegraded }
	return Health{Mode: mode, ProviderReady: providerReady, IndexerReady: indexerReady, Canonical: false}
}
