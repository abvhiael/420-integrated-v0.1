package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type check struct {
	Name   string `json:"name"`
	Passed bool   `json:"passed"`
	Detail string `json:"detail,omitempty"`
}

type report struct {
	Phase           string         `json:"phase"`
	ExplorerURL     string         `json:"explorerUrl"`
	ExpectedChainID uint64         `json:"expectedChainId"`
	StartedAt       time.Time      `json:"startedAt"`
	CompletedAt     time.Time      `json:"completedAt"`
	Passed          bool           `json:"passed"`
	Checks          []check        `json:"checks"`
	Samples         map[string]any `json:"samples,omitempty"`
}

type validator struct {
	baseURL    string
	chainID    uint64
	http       *http.Client
	block      *uint64
	txHash     string
	address    string
	serviceID  string
	assetKey   string
	report     report
}

func main() {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("EXPLORER_LIVE_URL")), "/")
	if baseURL == "" { fatal(errors.New("EXPLORER_LIVE_URL is required")) }
	chainID := uint64(420)
	if raw := strings.TrimSpace(os.Getenv("EXPLORER_EXPECTED_CHAIN_ID")); raw != "" {
		parsed, err := strconv.ParseUint(raw, 10, 64)
		if err != nil || parsed == 0 { fatal(errors.New("EXPLORER_EXPECTED_CHAIN_ID must be a non-zero uint64")) }
		chainID = parsed
	}
	timeout := 10 * time.Second
	if raw := strings.TrimSpace(os.Getenv("EXPLORER_LIVE_TIMEOUT")); raw != "" {
		parsed, err := time.ParseDuration(raw)
		if err != nil || parsed <= 0 { fatal(errors.New("EXPLORER_LIVE_TIMEOUT must be a positive duration")) }
		timeout = parsed
	}
	v := newValidator(baseURL, chainID, &http.Client{Timeout: timeout})
	if raw := strings.TrimSpace(os.Getenv("EXPLORER_LIVE_BLOCK_NUMBER")); raw != "" {
		parsed, err := strconv.ParseUint(raw, 10, 64)
		if err != nil { fatal(errors.New("EXPLORER_LIVE_BLOCK_NUMBER must be a uint64")) }
		v.block = &parsed
	}
	v.txHash = strings.TrimSpace(os.Getenv("EXPLORER_LIVE_TX_HASH"))
	v.address = strings.TrimSpace(os.Getenv("EXPLORER_LIVE_ADDRESS"))
	v.serviceID = strings.TrimSpace(os.Getenv("EXPLORER_LIVE_SERVICE_ID"))
	v.assetKey = strings.TrimSpace(os.Getenv("EXPLORER_LIVE_ASSET_KEY"))
	result := v.run()
	encoded, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(encoded))
	if !result.Passed { os.Exit(1) }
}

func newValidator(baseURL string, chainID uint64, hc *http.Client) *validator {
	started := time.Now().UTC()
	return &validator{baseURL: strings.TrimRight(baseURL, "/"), chainID: chainID, http: hc, report: report{
		Phase: "EXP-7.2", ExplorerURL: strings.TrimRight(baseURL, "/"), ExpectedChainID: chainID,
		StartedAt: started, Passed: true, Samples: map[string]any{},
	}}
}

func (v *validator) run() report {
	v.require("liveness", "/v1/health")
	ready := v.require("readiness", "/v1/ready")
	if ready != nil { v.assertBool("readiness.ready", ready, "ready", true) }
	status := v.require("network-status", "/v1/status")
	if status != nil { v.assertNumber("network-status.chain", status, "chainId", float64(v.chainID)) }
	v.require("capabilities", "/v1/capabilities")

	blocks := v.require("blocks", "/v1/blocks?limit=3")
	var blockNumber uint64
	var txHash, address string
	if blocks != nil {
		rows, ok := blocks["blocks"].([]any)
		if !ok || len(rows) == 0 {
			v.fail("blocks.sample", "no live indexed blocks returned")
		} else if first, ok := rows[0].(map[string]any); ok {
			blockNumber = uint64(number(first["number"]))
			v.report.Samples["blockNumber"] = blockNumber
			v.report.Samples["blockHash"] = stringValue(first["hash"])
		}
	}
	if v.block != nil { blockNumber = *v.block; v.report.Samples["blockNumber"] = blockNumber }
	if blockNumber > 0 || blocks != nil {
		detail := v.require("block-detail", "/v1/blocks/"+strconv.FormatUint(blockNumber, 10))
		if detail != nil {
			if block, ok := detail["block"].(map[string]any); ok {
				if hash := stringValue(block["hash"]); hash != "" { v.report.Samples["blockHash"] = hash }
			}
			if logs, ok := detail["logs"].([]any); ok && len(logs) > 0 {
				if row, ok := logs[0].(map[string]any); ok {
					txHash = stringValue(row["transactionHash"])
					address = stringValue(row["address"])
				}
			}
		}
	}
	if v.txHash != "" { txHash = v.txHash }
	if v.address != "" { address = v.address }
	if txHash == "" {
		v.fail("transaction.sample", "no transaction sample discovered; seed a test transaction or set EXPLORER_LIVE_TX_HASH")
	} else {
		v.report.Samples["transactionHash"] = txHash
		v.require("transaction-detail", "/v1/transactions/"+url.PathEscape(txHash))
		v.require("receipt-detail", "/v1/receipts/"+url.PathEscape(txHash))
	}
	if address == "" {
		v.fail("address.sample", "no address sample discovered; seed a logged transaction or set EXPLORER_LIVE_ADDRESS")
	} else {
		v.report.Samples["address"] = address
		v.require("address-detail", "/v1/addresses/"+url.PathEscape(address)+"?limit=10")
	}

	services := v.require("registry", "/v1/services")
	serviceID := v.serviceID
	if services != nil && serviceID == "" {
		rows, _ := services["services"].([]any)
		if len(rows) == 0 {
			v.fail("registry.sample", "no registered services returned")
		} else if first, ok := rows[0].(map[string]any); ok {
			serviceID = stringValue(first["serviceId"])
		}
	}
	if serviceID == "" {
		v.fail("registry.sample", "no registered service sample available; set EXPLORER_LIVE_SERVICE_ID")
	} else {
		v.report.Samples["serviceId"] = serviceID
		v.require("registry-service", "/v1/services/"+url.PathEscape(serviceID))
	}

	assetPath := "/v1/assets/activity?limit=10"
	if v.assetKey != "" { assetPath += "&assetKey=" + url.QueryEscape(v.assetKey) }
	assets := v.require("asset-activity", assetPath)
	if assets != nil {
		transfers, _ := assets["transfers"].([]any)
		if len(transfers) == 0 {
			v.fail("asset-activity.sample", "no live asset transfer evidence returned")
		} else if first, ok := transfers[0].(map[string]any); ok {
			assetKey := stringValue(first["assetKey"])
			if assetKey == "" { assetKey = stringValue(assets["assetKey"]) }
			if assetKey == "" { v.fail("asset-activity.sample", "asset transfer missing assetKey") } else { v.report.Samples["assetKey"] = assetKey }
		}
	}

	consensus := v.require("consensus", "/v1/consensus")
	if consensus != nil {
		slot := number(consensus["currentSlot"])
		validators := number(consensus["activeValidatorCount"])
		if slot < 1 { v.fail("consensus.slot", fmt.Sprintf("currentSlot=%v", consensus["currentSlot"])) } else { v.pass("consensus.slot", fmt.Sprintf("currentSlot=%.0f", slot)); v.report.Samples["currentSlot"] = uint64(slot) }
		if validators < 1 { v.fail("consensus.validators", fmt.Sprintf("activeValidatorCount=%v", consensus["activeValidatorCount"])) } else { v.pass("consensus.validators", fmt.Sprintf("activeValidatorCount=%.0f", validators)); v.report.Samples["activeValidatorCount"] = uint64(validators) }
	}
	v.report.CompletedAt = time.Now().UTC()
	return v.report
}

func (v *validator) require(name, path string) map[string]any {
	req, err := http.NewRequest(http.MethodGet, v.baseURL+path, nil)
	if err != nil { v.fail(name, err.Error()); return nil }
	resp, err := v.http.Do(req)
	if err != nil { v.fail(name, err.Error()); return nil }
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 { v.fail(name, "HTTP "+resp.Status); return nil }
	if err := validateBoundary(resp.Header); err != nil { v.fail(name, err.Error()); return nil }
	target := map[string]any{}
	if err := json.NewDecoder(resp.Body).Decode(&target); err != nil { v.fail(name, "invalid JSON: "+err.Error()); return nil }
	v.pass(name, resp.Status)
	return target
}

func validateBoundary(h http.Header) error {
	if h.Get("X-420-Service") != "420Explorer" { return errors.New("missing 420Explorer service provenance") }
	if h.Get("X-420-Data-Source") != "420Indexer" { return errors.New("missing 420Indexer data-source provenance") }
	if h.Get("X-420-Canonical-Authority") != "false" { return errors.New("Explorer response claimed canonical authority") }
	if h.Get("X-420-Consumer-Qualification") != "QUALIFIED_INDEXER_API_CONSUMER" { return errors.New("missing qualified Indexer consumer provenance") }
	return nil
}

func (v *validator) assertBool(name string, object map[string]any, key string, expected bool) {
	got, ok := object[key].(bool)
	if !ok || got != expected { v.fail(name, fmt.Sprintf("%s=%v", key, object[key])); return }
	v.pass(name, fmt.Sprintf("%s=%v", key, got))
}

func (v *validator) assertNumber(name string, object map[string]any, key string, expected float64) {
	got := number(object[key])
	if got != expected { v.fail(name, fmt.Sprintf("%s=%v expected=%v", key, object[key], expected)); return }
	v.pass(name, fmt.Sprintf("%s=%.0f", key, got))
}

func (v *validator) pass(name, detail string) { v.report.Checks = append(v.report.Checks, check{Name:name, Passed:true, Detail:detail}) }
func (v *validator) fail(name, detail string) { v.report.Passed = false; v.report.Checks = append(v.report.Checks, check{Name:name, Passed:false, Detail:detail}) }
func number(v any) float64 { if n, ok := v.(float64); ok { return n }; return -1 }
func stringValue(v any) string { if s, ok := v.(string); ok { return s }; return "" }
func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(2) }
