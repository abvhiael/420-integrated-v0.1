package dashboard

import (
	"html/template"
	"net/http"
	"strconv"
	"time"
)

const Route = "/dashboard"

type StatusView struct {
	ChainID       uint64
	IndexedHeight uint64
	SafeHeight    uint64
	IndexedAt     time.Time
	Stale         bool
}

type StatusProvider func() StatusView

type Shell struct {
	status StatusProvider
	tmpl   *template.Template
}

type pageData struct {
	Status         StatusView
	IndexedAt      string
	FinalityDepth  uint64
	WindowPresets  []string
	Navigation     []navItem
	MethodologyURL string
	StatusURL      string
	MetricsURL     string
	SeriesURL      string
}

type navItem struct {
	Label string
	Href  string
}

func New(status StatusProvider) (*Shell, error) {
	if status == nil {
		status = func() StatusView { return StatusView{} }
	}
	t, err := template.New("analytics-dashboard").Parse(pageTemplate)
	if err != nil {
		return nil, err
	}
	return &Shell{status: status, tmpl: t}, nil
}

func (s *Shell) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET "+Route, s.serve)
	return mux
}

func (s *Shell) serve(w http.ResponseWriter, _ *http.Request) {
	status := s.status()
	var depth uint64
	if status.IndexedHeight >= status.SafeHeight {
		depth = status.IndexedHeight - status.SafeHeight
	}
	indexedAt := "unavailable"
	if !status.IndexedAt.IsZero() {
		indexedAt = status.IndexedAt.UTC().Format(time.RFC3339)
	}
	data := pageData{
		Status:        status,
		IndexedAt:     indexedAt,
		FinalityDepth: depth,
		WindowPresets: []string{"1h", "24h", "7d", "30d", "90d"},
		Navigation: []navItem{
			{Label: "Network", Href: Route + "#network"},
			{Label: "Validators", Href: Route + "#validators"},
			{Label: "Protocols", Href: Route + "#protocols"},
			{Label: "Economics", Href: Route + "#economics"},
			{Label: "Predictive", Href: Route + "#predictive"},
		},
		MethodologyURL: "/v1/methodologies",
		StatusURL:      "/v1/status",
		MetricsURL:     "/v1/metrics",
		SeriesURL:      "/v1/series",
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	if err := s.tmpl.Execute(w, data); err != nil {
		http.Error(w, "analytics dashboard render failed", http.StatusInternalServerError)
	}
}

func (s StatusView) ChainLabel() string {
	if s.ChainID == 0 {
		return "unavailable"
	}
	return strconv.FormatUint(s.ChainID, 10)
}

const pageTemplate = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>420Analytics</title>
<style>
:root{color-scheme:dark;background:#101311;color:#edf2ee;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;background:#101311;color:#edf2ee}a{color:inherit}.shell{display:grid;grid-template-columns:230px 1fr;min-height:100vh}.side{border-right:1px solid #29322c;padding:24px}.brand{font-weight:750;letter-spacing:.02em}.muted{color:#a7b1aa}.nav{display:grid;gap:8px;margin-top:28px}.nav a{padding:10px 12px;border-radius:8px;text-decoration:none}.nav a:hover,.nav a:focus{background:#1a211d}.main{padding:28px;max-width:1400px;width:100%}.top{display:flex;gap:18px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.trust{font-size:.86rem;padding:7px 10px;border:1px solid #3a463e;border-radius:999px}.overview{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:22px 0}.panel{background:#151a17;border:1px solid #29322c;border-radius:12px;padding:16px}.k{font-size:.78rem;color:#a7b1aa;text-transform:uppercase;letter-spacing:.07em}.v{font-size:1.35rem;font-weight:700;margin-top:6px}.controls{display:flex;gap:12px;flex-wrap:wrap;align-items:end}.controls label{display:grid;gap:6px;font-size:.85rem}.controls select,.controls input{background:#0e120f;color:#edf2ee;border:1px solid #39443d;border-radius:8px;padding:9px 10px}.controls button{border:1px solid #526156;background:#1d2721;color:#edf2ee;border-radius:8px;padding:10px 14px;cursor:pointer}.method{margin-left:auto}.sections{display:grid;gap:14px;margin-top:20px}.placeholder{min-height:120px;display:flex;align-items:center;justify-content:center;color:#8e9a92;border:1px dashed #39443d;border-radius:10px}.status-stale{color:#ffcc80}.status-fresh{color:#a9e3b8}@media(max-width:760px){.shell{grid-template-columns:1fr}.side{border-right:0;border-bottom:1px solid #29322c}.nav{grid-template-columns:repeat(2,minmax(0,1fr))}.main{padding:18px}}
</style>
</head>
<body>
<div class="shell">
<aside class="side" aria-label="Analytics navigation">
<div class="brand">420Analytics</div>
<div class="muted">derived, rebuildable, non-canonical</div>
<nav class="nav">{{range .Navigation}}<a href="{{.Href}}">{{.Label}}</a>{{end}}</nav>
</aside>
<main class="main">
<div class="top"><div><h1>Network overview</h1><div class="muted">Public analytics from the qualified 420Indexer projection boundary.</div></div><div class="trust">non-canonical analytics</div></div>
<section id="network" class="overview" aria-label="Network overview">
<div class="panel"><div class="k">Chain ID</div><div class="v">{{.Status.ChainLabel}}</div></div>
<div class="panel"><div class="k">Indexed height</div><div class="v">{{.Status.IndexedHeight}}</div></div>
<div class="panel"><div class="k">Safe height</div><div class="v">{{.Status.SafeHeight}}</div></div>
<div class="panel"><div class="k">Finality depth</div><div class="v">{{.FinalityDepth}}</div></div>
<div class="panel"><div class="k">Indexed at</div><div class="v" style="font-size:1rem">{{.IndexedAt}}</div></div>
<div class="panel"><div class="k">Freshness</div><div class="v {{if .Status.Stale}}status-stale{{else}}status-fresh{{end}}">{{if .Status.Stale}}stale{{else}}fresh{{end}}</div></div>
</section>
<section class="panel" aria-label="Analytics filters">
<form class="controls" action="{{.SeriesURL}}" method="get">
<label>Window<select name="window" id="window">{{range .WindowPresets}}<option value="{{.}}">{{.}}</option>{{end}}</select></label>
<label>Metric ID<input name="metricId" maxlength="128" placeholder="network.indexed_height"></label>
<button type="submit">Open series API</button>
<a class="method" href="{{.MethodologyURL}}">Browse methodologies</a>
</form>
</section>
<div class="sections">
<section id="validators" class="panel"><h2>Validators</h2><div class="placeholder">metric presentation arrives in ANALYTICS-7.2</div></section>
<section id="protocols" class="panel"><h2>Protocols</h2><div class="placeholder">metric presentation arrives in ANALYTICS-7.2</div></section>
<section id="economics" class="panel"><h2>Economics</h2><div class="placeholder">metric presentation arrives in ANALYTICS-7.2</div></section>
<section id="predictive" class="panel"><h2>Predictive</h2><div class="placeholder">forecast/anomaly presentation arrives in ANALYTICS-7.2/7.3</div></section>
</div>
<footer class="muted" style="margin-top:24px">API: <a href="{{.StatusURL}}">status</a> · <a href="{{.MetricsURL}}">metrics</a> · <a href="{{.SeriesURL}}">series</a> · <a href="{{.MethodologyURL}}">methodologies</a></footer>
</main>
</div>
</body>
</html>`
