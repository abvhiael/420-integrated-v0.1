package api

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/status/aggregation"
	"github.com/420integrated/420-integrated/status/components"
	"github.com/420integrated/420-integrated/status/evidence"
	"github.com/420integrated/420-integrated/status/history"
	"github.com/420integrated/420-integrated/status/incidents"
)

type PublicAPI struct {
	registry  *components.Registry
	evidence  *evidence.Ingestor
	incidents *incidents.Store
	history   *history.Store
	now       func() time.Time
}

func NewPublicAPI(registry *components.Registry, evidenceStore *evidence.Ingestor, incidentStore *incidents.Store, historyStore *history.Store) (*PublicAPI, error) {
	if registry == nil || evidenceStore == nil || incidentStore == nil || historyStore == nil {
		return nil, errors.New("status public api requires registry, evidence, incident and history stores")
	}
	return &PublicAPI{registry: registry, evidence: evidenceStore, incidents: incidentStore, history: historyStore, now: time.Now}, nil
}

func (a *PublicAPI) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/status", a.handleNetwork)
	mux.HandleFunc("GET /v1/components", a.handleComponents)
	mux.HandleFunc("GET /v1/incidents", a.handleIncidents)
	mux.HandleFunc("GET /v1/maintenance", a.handleMaintenance)
	mux.HandleFunc("GET /v1/history", a.handleHistory)
	return mux
}

func (a *PublicAPI) handleNetwork(w http.ResponseWriter, _ *http.Request) {
	statuses, err := a.componentStatuses()
	if err != nil { writeError(w, err); return }
	rollup, err := aggregation.Aggregate(statuses)
	if err != nil { writeError(w, err); return }
	writeJSON(w, http.StatusOK, map[string]any{
		"canonical": false,
		"health": rollup.Health,
		"counts": map[string]int{
			"healthy": rollup.Healthy,
			"degraded": rollup.Degraded,
			"unavailable": rollup.Unavailable,
			"maintenance": rollup.Maintenance,
			"unknown": rollup.Unknown,
		},
		"components": rollup.Components,
	})
}

func (a *PublicAPI) handleComponents(w http.ResponseWriter, _ *http.Request) {
	statuses, err := a.componentStatuses()
	if err != nil { writeError(w, err); return }
	writeJSON(w, http.StatusOK, map[string]any{"canonical": false, "components": statuses})
}

func (a *PublicAPI) handleIncidents(w http.ResponseWriter, _ *http.Request) {
	active := a.incidents.Active()
	out := make([]incidents.Incident, 0, len(active))
	for _, i := range active {
		if i.Kind == incidents.KindIncident { out = append(out, i) }
	}
	writeJSON(w, http.StatusOK, map[string]any{"canonical": false, "incidents": out})
}

func (a *PublicAPI) handleMaintenance(w http.ResponseWriter, _ *http.Request) {
	active := a.incidents.Active()
	out := make([]incidents.Incident, 0)
	for _, i := range active {
		if i.Kind == incidents.KindMaintenance { out = append(out, i) }
	}
	writeJSON(w, http.StatusOK, map[string]any{"canonical": false, "maintenance": out})
}

type historyItem struct {
	Sequence   uint64             `json:"sequence"`
	RecordedAt time.Time          `json:"recorded_at"`
	Type       string             `json:"type"`
	Observation *evidence.Observation `json:"observation,omitempty"`
	Incident    *incidents.Incident    `json:"incident,omitempty"`
}

func (a *PublicAPI) handleHistory(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		v, err := strconv.Atoi(raw)
		if err != nil || v < 1 || v > 200 { writeJSON(w, http.StatusBadRequest, map[string]any{"error":"limit must be between 1 and 200"}); return }
		limit = v
	}
	cursor, err := decodeCursor(r.URL.Query().Get("cursor"))
	if err != nil { writeJSON(w, http.StatusBadRequest, map[string]any{"error":"invalid cursor"}); return }
	items := a.historyItems(cursor)
	if len(items) > limit { items = items[:limit] }
	next := ""
	if len(items) == limit {
		all := a.historyItems(cursor)
		if len(all) > limit { next = encodeCursor(items[len(items)-1].Sequence) }
	}
	writeJSON(w, http.StatusOK, map[string]any{"canonical": false, "items": items, "next_cursor": next})
}

func (a *PublicAPI) componentStatuses() ([]aggregation.ComponentStatus, error) {
	now := a.now()
	active := a.incidents.Active()
	registered := a.registry.List()
	out := make([]aggregation.ComponentStatus, 0, len(registered))
	for _, c := range registered {
		status, err := aggregation.Evaluate(c, a.evidence.Latest(c.ID), active, now)
		if err != nil { return nil, err }
		out = append(out, status)
	}
	return out, nil
}

func (a *PublicAPI) historyItems(after uint64) []historyItem {
	items := []historyItem{}
	for _, r := range a.history.Observations() {
		if r.Sequence <= after { continue }
		o := r.Observation
		items = append(items, historyItem{Sequence:r.Sequence, RecordedAt:r.RecordedAt, Type:"observation", Observation:&o})
	}
	for _, r := range a.history.Incidents() {
		if r.Sequence <= after { continue }
		i := r.Incident
		items = append(items, historyItem{Sequence:r.Sequence, RecordedAt:r.RecordedAt, Type:"incident", Incident:&i})
	}
	sortHistory(items)
	return items
}

func sortHistory(items []historyItem) {
	for i := 1; i < len(items); i++ {
		for j := i; j > 0 && items[j].Sequence < items[j-1].Sequence; j-- {
			items[j], items[j-1] = items[j-1], items[j]
		}
	}
}

func encodeCursor(sequence uint64) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strconv.FormatUint(sequence, 10)))
}

func decodeCursor(raw string) (uint64, error) {
	if strings.TrimSpace(raw) == "" { return 0, nil }
	b, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil { return 0, err }
	return strconv.ParseUint(string(b), 10, 64)
}

func writeError(w http.ResponseWriter, err error) {
	writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error(), "canonical": false})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
