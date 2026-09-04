package operator

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func idHex(b byte) string {
	raw := make([]byte, 32)
	raw[31] = b
	const h = "0123456789abcdef"
	out := make([]byte, 66)
	out[0], out[1] = '0', 'x'
	for i, v := range raw { out[2+i*2] = h[v>>4]; out[3+i*2] = h[v&15] }
	return string(out)
}

func validConfig() FileConfig {
	return FileConfig{
		OperatorID: idHex(1), Capabilities: []string{idHex(2)}, RPCURL: "http://127.0.0.1:8545", MarketAddress: "0x1111111111111111111111111111111111111111",
		CursorPath: "data/media.cursor", LeasePath: "data/media.leases", LeaseOwnerID: "node-a", SignerURL: "http://127.0.0.1:9000/sign", SignerTokenEnv: "MEDIA_SIGNER_TOKEN",
	}
}

func TestRuntimeValidatesAndDefaults(t *testing.T) {
	r, err := validConfig().Runtime()
	if err != nil { t.Fatal(err) }
	if r.Node.MaxParallel != 1 { t.Fatalf("max_parallel=%d", r.Node.MaxParallel) }
	if len(r.Node.Capabilities) != 1 { t.Fatalf("caps=%d", len(r.Node.Capabilities)) }
}

func TestSignerHTTPMustBeLoopback(t *testing.T) {
	c := validConfig(); c.SignerURL = "http://example.com/sign"
	if _, err := c.Runtime(); err == nil { t.Fatal("expected insecure remote signer url rejection") }
}

func TestSignerURLRejectsEmbeddedCredentials(t *testing.T) {
	c := validConfig(); c.SignerURL = "https://user:pass@example.com/sign"
	if _, err := c.Runtime(); err == nil { t.Fatal("expected embedded credentials rejection") }
}

func TestLoadFileAndRedactedNeverContainTokenValue(t *testing.T) {
	c := validConfig()
	dir := t.TempDir(); path := filepath.Join(dir, "config.json")
	data, _ := json.Marshal(c)
	if err := os.WriteFile(path, data, 0o600); err != nil { t.Fatal(err) }
	r, err := LoadFile(path); if err != nil { t.Fatal(err) }
	redacted := Redacted(r)
	if redacted["signer_token_env"] != "MEDIA_SIGNER_TOKEN" { t.Fatalf("redacted=%v", redacted) }
	for _, v := range redacted { if v == "super-secret" { t.Fatal("secret leaked") } }
}

func TestZeroCapabilityRejected(t *testing.T) {
	c := validConfig(); c.Capabilities = []string{idHex(0)}
	if _, err := c.Runtime(); err == nil { t.Fatal("expected zero capability rejection") }
}
