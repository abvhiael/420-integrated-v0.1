package api

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/status/aggregation"
	"github.com/420integrated/420-integrated/status/components"
	"github.com/420integrated/420-integrated/status/evidence"
	"github.com/420integrated/420-integrated/status/history"
	"github.com/420integrated/420-integrated/status/incidents"
	statussecurity "github.com/420integrated/420-integrated/status/security"
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
	writeJSON(w, http.StatusOK, map[string]any{"canonical": false, "incidents": a.publicIncidents(incidents.KindIncident)})
}

func (a *PublicAPI) handleMaintenance(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"canonical": false, "maintenance": a.publicIncidents(incidents.KindMaintenance)})
}

type publicObservation struct {
	ComponentID string               `json:"component_id"`
	SourceID string                  `json:"source_id"`
	Network string                   `json:"network"`
	Environment string               `json:"environment"`
	State components.Health          `json:"state"`
	Live bool                        `json:"live"`
	Ready bool                       `json:"ready"`
	ObservedAt time.Time              `json:"observed_at"`
	ExpiresAt time.Time               `json:"expires_at"`
	References []evidence.Reference   `json:"references,omitempty"`
}

type publicUpdate struct {
	At time.Time                  `json:"at"`
	State incidents.State         `json:"state"`
	Severity incidents.Severity   `json:"severity"`
	Summary string                `json:"summary"`
	Evidence []evidence.Reference `json:"evidence,omitempty"`
}

type publicIncident struct {
	ID string                       `json:"id"`
	Kind incidents.Kind             `json:"kind"`
	Title string                    `json:"title"`
	Network string                  `json:"network"`
	Environment string              `json:"environment"`
	AffectedComponents []string     `json:"affected_components"`
	StartedAt time.Time              `json:"started_at"`
	PlannedStart time.Time           `json:"planned_start,omitempty"`
	PlannedEnd time.Time             `json:"planned_end,omitempty"`
	Updates []publicUpdate           `json:"updates"`
}

type historyItem struct {
	Sequence   uint64             `json:"sequence"`
	RecordedAt time.Time          `json:"recorded_at"`
	Type       string             `json:"type"`
	Observation *publicObservation `json:"observation,omitempty"`
	Incident    *publicIncident    `json:"incident,omitempty"`
}

func (a *PublicAPI) handleHistory(w http.ResponseWriter, r *http.Request) {
	query, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error":"invalid query encoding"})
		return
	}
	limit := 50
	if raw := query.Get("limit"); raw != "" {
		v, err := strconv.Atoi(raw)
		if err != nil || v < 1 || v > 200 { writeJSON(w, http.StatusBadRequest, map[string]any{"error":"limit must be between 1 and 200"}); return }
		limit = v
	}
	cursor, err := decodeCursor(query.Get("cursor"))
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
		if !c.Public { continue }
		status, err := aggregation.Evaluate(c, a.evidence.Latest(c.ID), active, now)
		if err != nil { return nil, err }
		out = append(out, status)
	}
	return out, nil
}

func (a *PublicAPI) publicComponentIDs() map[string]bool {
	out := map[string]bool{}
	for _, c := range a.registry.List() { if c.Public { out[c.ID] = true } }
	return out
}

func (a *PublicAPI) publicIncidents(kind incidents.Kind) []publicIncident {
	publicIDs := a.publicComponentIDs()
	out := []publicIncident{}
	for _, i := range a.incidents.Active() {
		if i.Kind != kind { continue }
		if projected, ok := projectIncident(i, publicIDs); ok { out = append(out, projected) }
	}
	return out
}

func projectIncident(i incidents.Incident, publicIDs map[string]bool) (publicIncident, bool) {
	affected := make([]string, 0, len(i.AffectedComponents))
	for _, id := range i.AffectedComponents { if publicIDs[id] { affected = append(affected, id) } }
	if len(affected) == 0 { return publicIncident{}, false }
	updates := make([]publicUpdate, 0, len(i.Updates))
	for _, u := range i.Updates {
		summary := u.Summary
		if err := statussecurity.ValidatePublicText("incident summary", summary); err != nil { summary = "[redacted]" }
		refs := u.Evidence
		if err := statussecurity.ValidateReferences(refs); err != nil { refs = nil }
		updates = append(updates, publicUpdate{At:u.At, State:u.State, Severity:u.Severity, Summary:summary, Evidence:append([]evidence.Reference(nil), refs...)})
	}
	title := i.Title
	if err := statussecurity.ValidatePublicText("incident title", title); err != nil { title = "[redacted]" }
	return publicIncident{ID:i.ID, Kind:i.Kind, Title:title, Network:i.Network, Environment:i.Environment, AffectedComponents:affected, StartedAt:i.StartedAt, PlannedStart:i.PlannedStart, PlannedEnd:i.PlannedEnd, Updates:updates}, true
}

func projectObservation(o evidence.Observation, publicIDs map[string]bool) (*publicObservation, bool) {
	if !publicIDs[o.ComponentID] { return nil, false }
	refs := o.References
	if err := statussecurity.ValidateReferences(refs); err != nil { refs = nil }
	return &publicObservation{ComponentID:o.ComponentID, SourceID:o.SourceID, Network:o.Network, Environment:o.Environment, State:o.State, Live:o.Live, Ready:o.Ready, ObservedAt:o.ObservedAt, ExpiresAt:o.ExpiresAt, References:append([]evidence.Reference(nil), refs...)}, true
}

func (a *PublicAPI) historyItems(after uint64) []historyItem {
	items := []historyItem{}
	publicIDs := a.publicComponentIDs()
	for _, r := range a.history.Observations() {
		if r.Sequence <= after { continue }
		if o, ok := projectObservation(r.Observation, publicIDs); ok { items = append(items, historyItem{Sequence:r.Sequence, RecordedAt:r.RecordedAt, Type:"observation", Observation:o}) }
	}
	for _, r := range a.history.Incidents() {
		if r.Sequence <= after { continue }
		if i, ok := projectIncident(r.Incident, publicIDs); ok { items = append(items, historyItem{Sequence:r.Sequence, RecordedAt:r.RecordedAt, Type:"incident", Incident:&i}) }
	}
	sortHistory(items)
	return items
}

func sortHistory(items []historyItem) {
	for i := 1; i < len(items); i++ {
		for j := i; j > 0 && items[j].Sequence < items[j-1].Sequence; j-- { items[j], items[j-1] = items[j-1], items[j] }
	}
}

func encodeCursor(sequence uint64) string { return base64.RawURLEncoding.EncodeToString([]byte(strconv.FormatUint(sequence, 10))) }

func decodeCursor(raw string) (uint64, error) {
	if strings.TrimSpace(raw) == "" { return 0, nil }
	if raw != strings.TrimSpace(raw) { return 0, errors.New("cursor contains surrounding whitespace") }
	b, err := base64.RawURLEncoding.Strict().DecodeString(raw)
	if err != nil { return 0, err }
	if len(b) == 0 { return 0, errors.New("cursor payload is empty") }
	for _, ch := range b { if ch < '0' || ch > '9' { return 0, errors.New("cursor payload must be a decimal sequence") } }
	sequence, err := strconv.ParseUint(string(b), 10, 64)
	if err != nil { return 0, err }
	if sequence == 0 { return 0, errors.New("cursor sequence must be greater than zero") }
	if encodeCursor(sequence) != raw { return 0, errors.New("cursor is not canonical") }
	return sequence, nil
}

func writeError(w http.ResponseWriter, err error) { writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error(), "canonical": false}) }

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
