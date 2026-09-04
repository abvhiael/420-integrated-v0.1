package ethadapter

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
)

var ErrSignerResponse = errors.New("420media ethadapter: invalid signer response")

type HTTPSigner struct {
	url      string
	tokenEnv string
	client   *http.Client
}

func NewHTTPSigner(rawURL, tokenEnv string, client *http.Client) (*HTTPSigner, error) {
	u, err := url.Parse(rawURL)
	if err != nil || u.Host == "" || u.User != nil || tokenEnv == "" { return nil, errors.New("420media ethadapter: invalid signer config") }
	if u.Scheme != "https" {
		host := strings.ToLower(u.Hostname())
		if u.Scheme != "http" || (host != "127.0.0.1" && host != "localhost" && host != "::1") {
			return nil, errors.New("420media ethadapter: signer requires https or loopback http")
		}
	}
	if client == nil { client = http.DefaultClient }
	return &HTTPSigner{url: rawURL, tokenEnv: tokenEnv, client: client}, nil
}

type signerRequest struct {
	To   string `json:"to"`
	Data string `json:"data"`
}

type signerResponse struct {
	TxHash string `json:"tx_hash"`
}

func (s *HTTPSigner) SendTransaction(ctx context.Context, to string, data []byte) (string, error) {
	if !validAddress(to) || len(data) < 4 { return "", errors.New("420media ethadapter: invalid signer transaction") }
	token := os.Getenv(s.tokenEnv)
	if token == "" { return "", errors.New("420media ethadapter: signer token unavailable") }
	payload, err := json.Marshal(signerRequest{To: strings.ToLower(to), Data: "0x" + hex.EncodeToString(data)})
	if err != nil { return "", err }
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.url, bytes.NewReader(payload))
	if err != nil { return "", err }
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := s.client.Do(req)
	if err != nil { return "", err }
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if err != nil { return "", err }
	if resp.StatusCode < 200 || resp.StatusCode > 299 { return "", fmt.Errorf("420media ethadapter: signer http status %d", resp.StatusCode) }
	var decoded signerResponse
	if err := json.Unmarshal(body, &decoded); err != nil { return "", ErrSignerResponse }
	if !validTxHash(decoded.TxHash) { return "", ErrSignerResponse }
	return strings.ToLower(decoded.TxHash), nil
}

func validTxHash(v string) bool {
	if len(v) != 66 || !strings.HasPrefix(v, "0x") { return false }
	_, err := hex.DecodeString(v[2:]); return err == nil
}

var _ Signer = (*HTTPSigner)(nil)
