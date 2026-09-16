package runtime

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type RPCProbe struct {
	url     string
	address string
	client  *http.Client
}

func NewRPCProbe(cfg Config) *RPCProbe {
	return &RPCProbe{url: cfg.RPCURL, address: cfg.ReadinessAddress, client: &http.Client{Timeout: 10 * time.Second}}
}

func (p *RPCProbe) ChainID(ctx context.Context) (uint64, error) {
	var out string
	if err := p.call(ctx, "eth_chainId", []any{}, &out); err != nil { return 0, err }
	v, err := strconv.ParseUint(strings.TrimPrefix(out, "0x"), 16, 64)
	if err != nil || v == 0 { return 0, errors.New("invalid eth_chainId response") }
	return v, nil
}

func (p *RPCProbe) CanonicalBytecodeAvailable(ctx context.Context) error {
	var code string
	if err := p.call(ctx, "eth_getCode", []any{p.address, "latest"}, &code); err != nil { return err }
	if code == "" || code == "0x" { return errors.New("readiness address has no deployed bytecode") }
	return nil
}

func (p *RPCProbe) call(ctx context.Context, method string, params []any, out any) error {
	body, _ := json.Marshal(map[string]any{"jsonrpc":"2.0","id":1,"method":method,"params":params})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.url, bytes.NewReader(body)); if err != nil { return err }
	req.Header.Set("Content-Type", "application/json")
	res, err := p.client.Do(req); if err != nil { return err }
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK { return fmt.Errorf("rpc status %d", res.StatusCode) }
	var envelope struct { Result json.RawMessage `json:"result"`; Error *struct { Code int `json:"code"`; Message string `json:"message"` } `json:"error"` }
	if err := json.NewDecoder(res.Body).Decode(&envelope); err != nil { return err }
	if envelope.Error != nil { return fmt.Errorf("rpc %d: %s", envelope.Error.Code, envelope.Error.Message) }
	if len(envelope.Result) == 0 { return errors.New("rpc response missing result") }
	return json.Unmarshal(envelope.Result, out)
}
