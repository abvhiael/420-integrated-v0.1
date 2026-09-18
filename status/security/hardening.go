package security

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"
	"unicode"

	"github.com/420integrated/420-integrated/status/evidence"
)

const (
	MaxIdentifierBytes = 128
	MaxReferenceKindBytes = 64
	MaxReferenceValueBytes = 512
	MaxReferences = 32
	MaxPublicTextBytes = 2048
)

func ValidateIdentifier(name, value string) error {
	value = strings.TrimSpace(value)
	if value == "" { return fmt.Errorf("%s is required", name) }
	if len(value) > MaxIdentifierBytes { return fmt.Errorf("%s exceeds %d bytes", name, MaxIdentifierBytes) }
	for _, r := range value {
		if unicode.IsControl(r) || unicode.IsSpace(r) { return fmt.Errorf("%s contains unsafe characters", name) }
		if !(unicode.IsLetter(r) || unicode.IsDigit(r) || strings.ContainsRune("-._:/@", r)) {
			return fmt.Errorf("%s contains unsafe characters", name)
		}
	}
	return nil
}

func ValidateReferences(refs []evidence.Reference) error {
	if len(refs) > MaxReferences { return fmt.Errorf("too many evidence references: %d", len(refs)) }
	for _, ref := range refs {
		if err := ValidateIdentifier("reference kind", ref.Kind); err != nil { return err }
		if len(ref.Kind) > MaxReferenceKindBytes { return fmt.Errorf("reference kind exceeds %d bytes", MaxReferenceKindBytes) }
		value := strings.TrimSpace(ref.Value)
		if value == "" { return errors.New("reference value is required") }
		if len(value) > MaxReferenceValueBytes { return fmt.Errorf("reference value exceeds %d bytes", MaxReferenceValueBytes) }
		for _, r := range value { if unicode.IsControl(r) { return errors.New("reference value contains control characters") } }
	}
	return nil
}

func ValidatePublicText(name, value string) error {
	if len(value) > MaxPublicTextBytes { return fmt.Errorf("%s exceeds %d bytes", name, MaxPublicTextBytes) }
	for _, r := range value { if unicode.IsControl(r) && r != '\n' && r != '\t' { return fmt.Errorf("%s contains control characters", name) } }
	return nil
}

// ValidateProbeURL rejects obvious SSRF targets before any connection is attempted.
// DNS answers are checked separately at dial time by runtime probes.
func ValidateProbeURL(raw string) error {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme == "" || u.Host == "" { return errors.New("probe target must be an absolute URL") }
	if u.Scheme != "http" && u.Scheme != "https" { return errors.New("probe target must use http or https") }
	if u.User != nil { return errors.New("probe target userinfo is forbidden") }
	if u.Fragment != "" { return errors.New("probe target fragment is forbidden") }
	host := strings.TrimSuffix(strings.ToLower(u.Hostname()), ".")
	if host == "" || host == "localhost" || strings.HasSuffix(host, ".localhost") || host == "metadata.google.internal" {
		return errors.New("probe target host is forbidden")
	}
	if ip := net.ParseIP(host); ip != nil && !PublicIP(ip) { return errors.New("probe target must not use a private or special-purpose IP") }
	return nil
}

func PublicIP(ip net.IP) bool {
	return ip != nil && !ip.IsLoopback() && !ip.IsPrivate() && !ip.IsLinkLocalUnicast() && !ip.IsLinkLocalMulticast() && !ip.IsUnspecified() && !ip.IsMulticast()
}
