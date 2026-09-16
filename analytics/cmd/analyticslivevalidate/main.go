package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"
)

type check struct {
	Name   string `json:"name"`
	Passed bool   `json:"passed"`
	Detail string `json:"detail,omitempty"`
}

type report struct {
	Schema      string         `json:"schema"`
	Phase       string         `json:"phase"`
	AnalyticsURL string        `json:"analyticsUrl"`
	StartedAt   time.Time      `json:"startedAt"`
	CompletedAt time.Time      `json:"completedAt"`
	Passed      bool           `json:"passed"`
	Checks      []check        `json:"checks"`
	Samples     map[string]any `json:"samples,omitempty"`
}

type validator struct {
	baseURL string
	http    *http.Client
	report  report
}

var requiredNetworkMetrics = map[string]bool{
	"network.indexed_height": true,
	"network.safe_height": true,
	"network.finality_depth": true,
	"network.projection_lag": true,
}

func main() {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("ANALYTICS_LIVE_URL")), "/")
	if baseURL == "" { fatal(errors.New("ANALYTICS_LIVE_URL is required")) }
	u, err := url.Parse(baseURL)
	if err != nil || u.Scheme == "" || u.Host == "" { fatal(errors.New("ANALYTICS_LIVE_URL must be an absolute http(s) URL")) }
	timeout := 15 * time.Second
	if raw := strings.TrimSpace(os.Getenv("ANALYTICS_LIVE_TIMEOUT")); raw != "" {
		d, err := time.ParseDuration(raw)
		if err != nil || d <= 0 { fatal(errors.New("ANALYTICS_LIVE_TIMEOUT must be a positive duration")) }
		timeout = d
	}
	v := newValidator(baseURL, &http.Client{Timeout: timeout})
	result := v.run()
	encoded, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(encoded))
	if !result.Passed { os.Exit(1) }
}

func newValidator(baseURL string, hc *http.Client) *validator {
	started := time.Now().UTC()
	return &validator{baseURL: strings.TrimRight(baseURL, "/"), http: hc, report: report{
		Schema: "420-analytics-testnet-qualification-v1", Phase: "ANALYTICS-9",
		AnalyticsURL: strings.TrimRight(baseURL, "/"), StartedAt: started, Passed: true,
		Samples: map[string]any{},
	}}
}

func (v *validator) run() report {
	v.requireObject("health", "/health", func(body map[string]any) bool {
		return stringValue(body["status"]) == "ok" && stringValue(body["service"]) == "420Analytics" && stringValue(body["apiVersion"]) == "v1"
	})
	v.requireObject("readiness", "/ready", func(body map[string]any) bool { ready, _ := body["ready"].(bool); return ready })
	status := v.require("status", "/v1/status")
	if status != nil { v.validateStatus(status) }
	caps := v.require("capabilities", "/v1/capabilities")
	if caps != nil {
		canonical, _ := caps["canonical"].(bool)
		rebuildable, _ := caps["rebuildable"].(bool)
		if canonical || !rebuildable { v.fail("capabilities.authority", fmt.Sprintf("canonical=%v rebuildable=%v", canonical, rebuildable)) } else { v.pass("capabilities.authority", "non-canonical and rebuildable") }
	}
	metrics := v.require("metrics", "/v1/metrics?limit=100")
	if metrics != nil { v.validateMetrics(metrics) }
	snapshots := v.require("snapshots", "/v1/snapshots?limit=10")
	if snapshots != nil { v.validateSnapshots(snapshots) }
	methodologies := v.require("methodologies", "/v1/methodologies?limit=100")
	if methodologies != nil {
		if number(methodologies["count"]) < 4 { v.fail("methodologies.seeded", fmt.Sprintf("count=%v", methodologies["count"])) } else { v.pass("methodologies.seeded", fmt.Sprintf("count=%.0f", number(methodologies["count"]))) }
	}
	v.report.CompletedAt = time.Now().UTC()
	return v.report
}

func (v *validator) validateStatus(body map[string]any) {
	chain := number(body["chainId"])
	indexed := number(body["indexedHeight"])
	safe := number(body["safeHeight"])
	canonical, _ := body["canonical"].(bool)
	stale, _ := body["stale"].(bool)
	if chain < 1 || indexed < 1 || safe < 0 || safe > indexed || canonical || stale {
		v.fail("status.contract", fmt.Sprintf("chain=%.0f indexed=%.0f safe=%.0f canonical=%v stale=%v", chain, indexed, safe, canonical, stale))
		return
	}
	v.report.Samples["chainId"] = uint64(chain)
	v.report.Samples["indexedHeight"] = uint64(indexed)
	v.report.Samples["safeHeight"] = uint64(safe)
	v.pass("status.contract", fmt.Sprintf("chain=%.0f indexed=%.0f safe=%.0f", chain, indexed, safe))
}

func (v *validator) validateMetrics(body map[string]any) {
	items, _ := body["items"].([]any)
	seen := map[string]bool{}
	for _, raw := range items {
		item, ok := raw.(map[string]any); if !ok { v.fail("metrics.item", "metric is not object"); continue }
		id := stringValue(item["id"])
		if requiredNetworkMetrics[id] { seen[id] = true }
		if source := nestedString(item, "provenance", "source"); source != "420Indexer" { v.fail("metrics.provenance", id+" source="+source) }
		method, _ := item["methodology"].(map[string]any)
		if strings.TrimSpace(stringValue(method["id"])) == "" || strings.TrimSpace(stringValue(method["version"])) == "" { v.fail("metrics.methodology", id+" missing methodology") }
		canonical, _ := item["canonical"].(bool)
		if canonical { v.fail("metrics.authority", id+" claimed canonical authority") }
	}
	missing := []string{}
	for id := range requiredNetworkMetrics { if !seen[id] { missing = append(missing, id) } }
	sort.Strings(missing)
	if len(missing) != 0 { v.fail("metrics.seeded-network", "missing="+strings.Join(missing, ",")); return }
	v.report.Samples["metricCount"] = len(items)
	v.pass("metrics.seeded-network", "all required network metrics present")
}

func (v *validator) validateSnapshots(body map[string]any) {
	items, _ := body["items"].([]any)
	if len(items) == 0 { v.fail("snapshots.seeded", "no snapshots"); return }
	for _, raw := range items {
		item, ok := raw.(map[string]any); if !ok { v.fail("snapshots.item", "snapshot is not object"); continue }
		if nestedString(item, "provenance", "source") != "420Indexer" { v.fail("snapshots.provenance", "snapshot source is not 420Indexer") }
	}
	v.report.Samples["snapshotCount"] = len(items)
	v.pass("snapshots.seeded", fmt.Sprintf("count=%d", len(items)))
}

func (v *validator) requireObject(name, path string, valid func(map[string]any) bool) {
	body := v.require(name, path)
	if body == nil { return }
	if !valid(body) { v.fail(name+".contract", "response contract invalid"); return }
	v.pass(name+".contract", "qualified")
}

func (v *validator) require(name, path string) map[string]any {
	req, err := http.NewRequest(http.MethodGet, v.baseURL+path, nil)
	if err != nil { v.fail(name, err.Error()); return nil }
	resp, err := v.http.Do(req)
	if err != nil { v.fail(name, err.Error()); return nil }
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK { v.fail(name, "HTTP "+resp.Status); return nil }
	body := map[string]any{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil { v.fail(name, "invalid JSON: "+err.Error()); return nil }
	v.pass(name, resp.Status)
	return body
}

func (v *validator) pass(name, detail string) { v.report.Checks = append(v.report.Checks, check{Name:name, Passed:true, Detail:detail}) }
func (v *validator) fail(name, detail string) { v.report.Passed=false; v.report.Checks=append(v.report.Checks, check{Name:name, Passed:false, Detail:detail}) }
func number(v any) float64 { if n,ok:=v.(float64); ok { return n }; return -1 }
func stringValue(v any) string { if s,ok:=v.(string); ok { return s }; return "" }
func nestedString(m map[string]any, key, child string) string { n, _ := m[key].(map[string]any); return stringValue(n[child]) }
func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(2) }
