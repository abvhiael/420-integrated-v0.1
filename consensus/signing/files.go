package signing

import (
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/420integrated/420-integrated/consensus/recovery"
)

// PrivateFile excludes symlink aliases and group/world-readable credentials.
func PrivateFile(path string) ([]byte, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	dir := filepath.Dir(abs)
	resolved, err := filepath.EvalSymlinks(dir)
	if err != nil || resolved != dir {
		return nil, fmt.Errorf("aliased credential directory")
	}
	st, err := os.Stat(dir)
	if err != nil || st.Mode().Perm()&0077 != 0 {
		return nil, fmt.Errorf("private credential directory required")
	}
	file, err := os.OpenFile(abs, os.O_RDONLY|syscall.O_NOFOLLOW, 0)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	st, err = file.Stat()
	if err != nil || !st.Mode().IsRegular() || st.Mode().Perm()&0077 != 0 {
		return nil, fmt.Errorf("private credential file required")
	}
	return io.ReadAll(io.LimitReader(file, 1<<20))
}
func LoadPolicy(path, pin string) (Policy, error) {
	var p Policy
	b, err := os.ReadFile(path)
	if err != nil {
		return p, err
	}
	sum := sha256.Sum256(b)
	if len(pin) != 64 || hex.EncodeToString(sum[:]) != pin {
		return p, fmt.Errorf("signing policy pin mismatch")
	}
	if err = recovery.Decode(b, &p); err != nil {
		return p, err
	}
	return p, p.Validate()
}
func LoadTLS(certPath, keyPath, caPath, pin string, server bool) (*tls.Config, [32]byte, error) {
	var peer [32]byte
	raw, err := hex.DecodeString(pin)
	if err != nil || len(raw) != 32 {
		return nil, peer, fmt.Errorf("SHA-256 peer SPKI pin required")
	}
	copy(peer[:], raw)
	certRaw, err := os.ReadFile(certPath)
	if err != nil {
		return nil, peer, err
	}
	keyRaw, err := PrivateFile(keyPath)
	if err != nil {
		return nil, peer, err
	}
	cert, err := tls.X509KeyPair(certRaw, keyRaw)
	if err != nil {
		return nil, peer, err
	}
	rootsRaw, err := os.ReadFile(caPath)
	if err != nil {
		return nil, peer, err
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(rootsRaw) {
		return nil, peer, fmt.Errorf("invalid signer CA")
	}
	config, err := MutualTLS(cert, roots, peer, server)
	return config, peer, err
}
func LoadWitnessDSN(path string) (string, error) {
	raw, err := PrivateFile(path)
	if err != nil {
		return "", err
	}
	dsn := strings.TrimSpace(string(raw))
	u, err := url.Parse(dsn)
	if err != nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") || u.Hostname() == "" || u.Query().Get("sslmode") != "verify-full" || u.Query().Get("sslrootcert") == "" || u.Query().Get("connect_timeout") == "" {
		return "", fmt.Errorf("independent witness requires verified PostgreSQL TLS and bounded connection timeout")
	}
	if u.User == nil || u.User.Username() == "" {
		return "", fmt.Errorf("dedicated witness identity required")
	}
	password, _ := u.User.Password()
	if password == "" && (u.Query().Get("sslcert") == "" || u.Query().Get("sslkey") == "") {
		return "", fmt.Errorf("witness password or client certificate credentials required")
	}
	for _, values := range u.Query() {
		if len(values) != 1 {
			return "", fmt.Errorf("duplicate witness connection option")
		}
	}
	rootPath := u.Query().Get("sslrootcert")
	absolute, err := filepath.Abs(rootPath)
	if err != nil {
		return "", err
	}
	resolved, err := filepath.EvalSymlinks(absolute)
	if err != nil || resolved != absolute {
		return "", fmt.Errorf("aliased witness trust root")
	}
	st, err := os.Stat(absolute)
	if err != nil || !st.Mode().IsRegular() || st.Mode().Perm()&0022 != 0 {
		return "", fmt.Errorf("writable witness trust root")
	}
	st, err = os.Stat(filepath.Dir(absolute))
	if err != nil || st.Mode().Perm()&0022 != 0 {
		return "", fmt.Errorf("writable witness trust directory")
	}
	return dsn, nil
}
