package runtime

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const maxRPCResponseBytes = 1 << 20

type HTTPExecutionProbe struct {
	url string
	client *http.Client
}

func NewHTTPExecutionProbe(rawURL string, timeout time.Duration) (*HTTPExecutionProbe, error) {
	if err := requireURL("execution rpc", rawURL); err != nil { return nil, err }
	if timeout <= 0 { return nil, errors.New("request timeout must be positive") }
	return &HTTPExecutionProbe{url:rawURL, client:&http.Client{Timeout:timeout}}, nil
}

type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID int `json:"id"`
	Method string `json:"method"`
	Params any `json:"params"`
}

type rpcResponse struct {
	Result json.RawMessage `json:"result"`
	Error *struct {
		Code int `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func (p *HTTPExecutionProbe) call(ctx context.Context, method string, params any, out any) error {
	body, err := json.Marshal(rpcRequest{JSONRPC:"2.0", ID:1, Method:method, Params:params})
	if err != nil { return err }
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.url, bytes.NewReader(body))
	if err != nil { return err }
	req.Header.Set("Content-Type","application/json")
	resp, err := p.client.Do(req)
	if err != nil { return err }
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK { return fmt.Errorf("rpc status %d", resp.StatusCode) }
	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxRPCResponseBytes+1))
	if err != nil { return err }
	if len(raw) > maxRPCResponseBytes { return errors.New("rpc response too large") }
	var decoded rpcResponse
	if err := json.Unmarshal(raw,&decoded); err != nil { return err }
	if decoded.Error != nil { return fmt.Errorf("rpc error %d: %s", decoded.Error.Code, decoded.Error.Message) }
	if len(decoded.Result)==0 || string(decoded.Result)=="null" { return errors.New("rpc result missing") }
	if err := json.Unmarshal(decoded.Result,out); err != nil { return err }
	return nil
}

func (p *HTTPExecutionProbe) ChainID(ctx context.Context) (uint64,error) {
	var raw string
	if err := p.call(ctx,"eth_chainId",[]any{},&raw); err != nil { return 0,err }
	v,err:=strconv.ParseUint(strings.TrimPrefix(raw,"0x"),16,64)
	if err!=nil || v==0 { return 0,errors.New("invalid chain id") }
	return v,nil
}

func (p *HTTPExecutionProbe) EntryPointCode(ctx context.Context, entryPoint string) (string,error) {
	var code string
	if err:=p.call(ctx,"eth_getCode",[]any{entryPoint,"latest"},&code); err!=nil { return "",err }
	return code,nil
}

func (p *HTTPExecutionProbe) LatestBlockTime(ctx context.Context) (time.Time,error) {
	var block struct { Timestamp string `json:"timestamp"` }
	if err:=p.call(ctx,"eth_getBlockByNumber",[]any{"latest",false},&block); err!=nil { return time.Time{},err }
	if block.Timestamp=="" { return time.Time{},errors.New("latest block timestamp missing") }
	v,err:=strconv.ParseUint(strings.TrimPrefix(block.Timestamp,"0x"),16,64)
	if err!=nil { return time.Time{},errors.New("invalid latest block timestamp") }
	return time.Unix(int64(v),0).UTC(),nil
}
