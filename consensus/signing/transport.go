package signing

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/420integrated/420-integrated/consensus/recovery"
	"github.com/420integrated/420-integrated/consensus/slashing"
)

func p256Certificate(c *x509.Certificate) bool {
	p, ok := c.PublicKey.(*ecdsa.PublicKey)
	return ok && p.Curve == elliptic.P256()
}
func SPKIPin(c *x509.Certificate) [32]byte { return sha256.Sum256(c.RawSubjectPublicKeyInfo) }

// MutualTLS requires dedicated P-256 transport credentials, excluding the
// secp256k1 Wallet/owner key class and the validator's BLS key. Peer pins are
// provisioned independently, in addition to ordinary CA/name/EKU verification.
func MutualTLS(cert tls.Certificate, ca *x509.CertPool, peer [32]byte, server bool) (*tls.Config, error) {
	if len(cert.Certificate) == 0 || ca == nil || peer == ([32]byte{}) {
		return nil, fmt.Errorf("mTLS credentials and peer pin required")
	}
	leaf, err := x509.ParseCertificate(cert.Certificate[0])
	if err != nil || !p256Certificate(leaf) || SPKIPin(leaf) == peer {
		return nil, fmt.Errorf("distinct P-256 transport identities required")
	}
	config := &tls.Config{MinVersion: tls.VersionTLS13, Certificates: []tls.Certificate{cert}, RootCAs: ca}
	if server {
		config.ClientCAs = ca
		config.ClientAuth = tls.RequireAndVerifyClientCert
	}
	config.VerifyConnection = func(state tls.ConnectionState) error {
		if len(state.VerifiedChains) == 0 || len(state.PeerCertificates) == 0 || !p256Certificate(state.PeerCertificates[0]) || SPKIPin(state.PeerCertificates[0]) != peer {
			return fmt.Errorf("untrusted signer transport identity")
		}
		return nil
	}
	return config, nil
}
func Handler(s *Signer, clientPin [32]byte) http.Handler { return ObservingHandler(s, clientPin, nil) }

// ObservingHandler reports only the outcome to a local categorical observer.
// It cannot change signing authorization, reservations or responses.
func ObservingHandler(s *Signer, clientPin [32]byte, observe func(error)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.TLS == nil || len(r.TLS.VerifiedChains) == 0 || len(r.TLS.PeerCertificates) == 0 || SPKIPin(r.TLS.PeerCertificates[0]) != clientPin {
			http.Error(w, "unauthorized validator", http.StatusUnauthorized)
			return
		}
		if r.Method == "GET" && r.URL.Path == "/v1/health" && r.URL.RawQuery == "" {
			ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
			defer cancel()
			err := s.Health(ctx)
			if observe != nil {
				observe(err)
			}
			if err != nil {
				http.Error(w, "protected signer unavailable", http.StatusServiceUnavailable)
			} else {
				w.WriteHeader(http.StatusNoContent)
			}
			return
		}
		if r.Method != "POST" || r.URL.Path != "/v1/sign" || r.URL.RawQuery != "" {
			http.Error(w, "unsupported signing operation", http.StatusBadRequest)
			return
		}
		raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 64<<10))
		if err != nil {
			http.Error(w, "invalid duty", http.StatusBadRequest)
			return
		}
		var duty Duty
		if err = recovery.Decode(raw, &duty); err != nil {
			http.Error(w, "invalid duty", http.StatusBadRequest)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		result, err := s.Sign(ctx, duty)
		if observe != nil {
			observe(err)
		}
		if err != nil {
			http.Error(w, "protected signing refused", http.StatusConflict)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(result)
	})
}

type Client struct {
	mu        sync.Mutex
	endpoint  string
	policy    Policy
	protector *slashing.Protector
	http      *http.Client
	failed    error
}

func NewClient(endpoint string, config *tls.Config, p Policy, protector *slashing.Protector) (*Client, error) {
	if err := backendReady(); err != nil {
		return nil, err
	}
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
		return nil, fmt.Errorf("dedicated HTTPS signer endpoint required")
	}
	if err = p.Validate(); err != nil {
		return nil, err
	}
	if config == nil || config.InsecureSkipVerify || config.MinVersion < tls.VersionTLS13 || config.RootCAs == nil || config.VerifyConnection == nil || len(config.Certificates) != 1 || protector == nil {
		return nil, fmt.Errorf("verified mTLS and local protection required")
	}
	id, err := protector.HistoryIdentity()
	if err != nil {
		return nil, err
	}
	if id != p.Identity {
		return nil, slashing.ErrInvalidDuty
	}
	if _, err = protector.Snapshot(); err != nil {
		return nil, err
	}
	return &Client{endpoint: strings.TrimRight(u.String(), "/") + "/v1/sign", policy: p, protector: protector, http: &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return fmt.Errorf("signer redirects forbidden") }, Transport: &http.Transport{TLSClientConfig: config.Clone()}}}, nil
}
func (c *Client) Sign(ctx context.Context, d Duty) (result Result, err error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.failed != nil {
		return result, c.failed
	}
	defer func() {
		if err != nil {
			c.failed = fmt.Errorf("protected signing client halted: %w", err)
		}
	}()
	if _, err = c.policy.Reserve(c.protector, d); err != nil {
		return result, err
	}
	raw, err := json.Marshal(d)
	if err != nil {
		return result, err
	}
	request, err := http.NewRequestWithContext(ctx, "POST", c.endpoint, bytes.NewReader(raw))
	if err != nil {
		return result, err
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := c.http.Do(request)
	if err != nil {
		return result, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return result, fmt.Errorf("remote signer rejected duty: HTTP %d", response.StatusCode)
	}
	raw, err = io.ReadAll(io.LimitReader(response.Body, (64<<10)+1))
	if err != nil {
		return result, err
	}
	if len(raw) > 64<<10 {
		return result, fmt.Errorf("oversized signer response")
	}
	if err = recovery.Decode(raw, &result); err != nil {
		return Result{}, err
	}
	if err = verifyResult(c.policy, d, result); err != nil {
		return Result{}, err
	}
	return result, nil
}
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.failed = slashing.ErrHistoryUnavailable
	c.http.CloseIdleConnections()
}
