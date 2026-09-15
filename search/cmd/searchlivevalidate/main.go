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
	Name string `json:"name"`
	Passed bool `json:"passed"`
	Detail string `json:"detail,omitempty"`
}

type report struct {
	Phase string `json:"phase"`
	SearchURL string `json:"searchUrl"`
	StartedAt time.Time `json:"startedAt"`
	CompletedAt time.Time `json:"completedAt"`
	Passed bool `json:"passed"`
	Checks []check `json:"checks"`
	Samples map[string]any `json:"samples,omitempty"`
}

type validator struct {
	baseURL string
	http *http.Client
	query string
	report report
}

var allowedDomains = map[string]bool{
	"block":true,"transaction":true,"address":true,"contract":true,"service":true,"name":true,
	"public_identity":true,"asset":true,"validator":true,"market_listing":true,"rights_record":true,
	"public_commons":true,"public_pulse":true,
}

func main() {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("SEARCH_LIVE_URL")), "/")
	if baseURL == "" { fatal(errors.New("SEARCH_LIVE_URL is required")) }
	u, err := url.Parse(baseURL)
	if err != nil || u.Scheme == "" || u.Host == "" { fatal(errors.New("SEARCH_LIVE_URL must be an absolute http(s) URL")) }
	timeout := 15*time.Second
	if raw := strings.TrimSpace(os.Getenv("SEARCH_LIVE_TIMEOUT")); raw != "" {
		d, err := time.ParseDuration(raw)
		if err != nil || d <= 0 { fatal(errors.New("SEARCH_LIVE_TIMEOUT must be a positive duration")) }
		timeout = d
	}
	query := strings.TrimSpace(os.Getenv("SEARCH_LIVE_QUERY"))
	if query == "" { query = "420" }
	v := newValidator(baseURL, &http.Client{Timeout:timeout}, query)
	result := v.run()
	encoded, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(encoded))
	if !result.Passed { os.Exit(1) }
}

func newValidator(baseURL string, hc *http.Client, query string) *validator {
	started := time.Now().UTC()
	return &validator{baseURL:strings.TrimRight(baseURL,"/"), http:hc, query:query, report:report{Phase:"SEARCH-9", SearchURL:strings.TrimRight(baseURL,"/"), StartedAt:started, Passed:true, Samples:map[string]any{}}}
}

func (v *validator) run() report {
	v.operational("health", "/v1/health")
	v.operational("readiness", "/v1/readiness")
	status := v.operational("status", "/v1/status")
	if status != nil {
		v.report.Samples["indexedHeight"] = uint64(number(status["indexedHeight"]))
		v.report.Samples["finalizedHeight"] = uint64(number(status["finalizedHeight"]))
	}
	caps := v.require("capabilities", "/v1/capabilities")
	if caps != nil {
		if stringValue(caps["api"]) != "420-search-http-v1" { v.fail("capabilities.api", fmt.Sprintf("api=%v", caps["api"])) } else { v.pass("capabilities.api", "420-search-http-v1") }
	}
	search := v.require("search", "/v1/search?q="+url.QueryEscape(v.query)+"&limit=25")
	if search != nil { v.validateSearch(search) }

	// Fail closed if a private-only domain is requested. Private Messenger,
	// private Commons, private Identity, encrypted Resource payloads and raw
	// Attention telemetry are intentionally outside the Search domain grammar.
	for _, q := range []string{"domain:messenger probe", "domain:private_identity probe", "domain:raw_attention_telemetry probe"} {
		v.requireStatus("privacy-exclusion "+q, "/v1/search?q="+url.QueryEscape(q), http.StatusBadRequest)
	}

	// Exact public-domain probes are optional seed checks. When supplied they
	// must resolve through Search and carry qualified provenance.
	probes := []struct{env,prefix,name string}{
		{"SEARCH_LIVE_BLOCK","block:","block"}, {"SEARCH_LIVE_TX","tx:","transaction"},
		{"SEARCH_LIVE_ADDRESS","address:","address"}, {"SEARCH_LIVE_SERVICE","service:","service"},
		{"SEARCH_LIVE_NAME_HASH","name:","name"}, {"SEARCH_LIVE_IDENTITY","identity:","public-identity"},
		{"SEARCH_LIVE_ASSET","asset:","asset"}, {"SEARCH_LIVE_VALIDATOR","validator:","validator"},
		{"SEARCH_LIVE_MARKET","market:","market"}, {"SEARCH_LIVE_RIGHTS","rights:","rights"},
		{"SEARCH_LIVE_COMMONS","commons:","commons"}, {"SEARCH_LIVE_PULSE","pulse:","pulse"},
	}
	for _, p := range probes {
		if value := strings.TrimSpace(os.Getenv(p.env)); value != "" {
			body := v.require("probe."+p.name, "/v1/search?q="+url.QueryEscape(p.prefix+value)+"&limit=5")
			if body != nil { v.validateSearch(body) }
		}
	}
	v.report.CompletedAt = time.Now().UTC()
	return v.report
}

func (v *validator) operational(name, path string) map[string]any {
	body := v.require(name, path)
	if body == nil { return nil }
	ok, _ := body["ok"].(bool)
	indexed := number(body["indexedHeight"])
	finalized := number(body["finalizedHeight"])
	if !ok || stringValue(body["state"]) != "ready" || indexed < 1 || finalized < 0 || finalized > indexed {
		v.fail(name+".contract", fmt.Sprintf("ok=%v state=%v indexed=%v finalized=%v", body["ok"], body["state"], body["indexedHeight"], body["finalizedHeight"]))
	} else { v.pass(name+".contract", fmt.Sprintf("indexed=%.0f finalized=%.0f", indexed, finalized)) }
	return body
}

func (v *validator) validateSearch(body map[string]any) {
	snapshot, ok := body["snapshot"].(map[string]any)
	if !ok { v.fail("search.snapshot", "missing snapshot"); return }
	indexed := number(snapshot["indexedHeight"])
	finalized := number(snapshot["finalizedHeight"])
	if indexed < 1 || finalized < 0 || finalized > indexed { v.fail("search.snapshot", fmt.Sprintf("indexed=%v finalized=%v", snapshot["indexedHeight"], snapshot["finalizedHeight"])); return }
	v.pass("search.snapshot", fmt.Sprintf("indexed=%.0f finalized=%.0f", indexed, finalized))
	rows, _ := body["results"].([]any)
	domains := map[string]struct{}{}
	for _, raw := range rows {
		row, ok := raw.(map[string]any); if !ok { v.fail("search.result", "result is not object"); continue }
		domain := stringValue(row["domain"])
		if !allowedDomains[domain] { v.fail("search.domain", "unexpected domain "+domain); continue }
		domains[domain] = struct{}{}
		prov, ok := row["provenance"].(map[string]any)
		if !ok || strings.TrimSpace(stringValue(prov["source"])) == "" || strings.TrimSpace(stringValue(prov["authority"])) == "" {
			v.fail("search.provenance", "missing qualified source/authority")
			continue
		}
		if strings.Contains(strings.ToLower(stringValue(prov["source"])), "private") { v.fail("search.privacy", "private source exposed: "+stringValue(prov["source"])) }
	}
	keys := make([]string,0,len(domains)); for d := range domains { keys=append(keys,d) }; sort.Strings(keys)
	v.report.Samples["resultDomains"] = keys
	v.pass("search.allowed-domains", fmt.Sprintf("results=%d domains=%v", len(rows), keys))
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

func (v *validator) requireStatus(name, path string, expected int) {
	req, err := http.NewRequest(http.MethodGet, v.baseURL+path, nil)
	if err != nil { v.fail(name, err.Error()); return }
	resp, err := v.http.Do(req)
	if err != nil { v.fail(name, err.Error()); return }
	defer resp.Body.Close()
	if resp.StatusCode != expected { v.fail(name, fmt.Sprintf("HTTP %d expected %d", resp.StatusCode, expected)); return }
	v.pass(name, resp.Status)
}

func (v *validator) pass(name, detail string) { v.report.Checks=append(v.report.Checks,check{Name:name,Passed:true,Detail:detail}) }
func (v *validator) fail(name, detail string) { v.report.Passed=false; v.report.Checks=append(v.report.Checks,check{Name:name,Passed:false,Detail:detail}) }
func number(v any) float64 { if n,ok:=v.(float64); ok { return n }; return -1 }
func stringValue(v any) string { if s,ok:=v.(string); ok { return s }; return "" }
func fatal(err error) { fmt.Fprintln(os.Stderr,err); os.Exit(2) }
