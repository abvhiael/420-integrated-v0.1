package inventory

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

var (
	ErrDenied   = errors.New("inventory unavailable")
	ErrInvalid  = errors.New("invalid inventory request")
	ErrConflict = errors.New("inventory conflict or insufficient stock")
)

type Scope struct {
	TenantID  string
	Principal security.Principal
	Grant     security.Grant
}
type Lot struct {
	TenantID, FacilityID, ZoneID, ID, Kind, Unit, Label, HarvestID string
	Opening                                                        float64
	CreatedBy                                                      string
	CreatedAt                                                      time.Time
}
type Entry struct {
	TenantID, FacilityID, ZoneID, LotID, ID, Kind, Reason, Actor, Source, IdempotencyKey, ReferenceID string
	Quantity                                                                                          float64
	OccurredAt                                                                                        time.Time
}
type Snapshot struct {
	Lot     Lot
	Balance float64
	Entries []Entry
}
type Store interface {
	Create(context.Context, Lot, string) error
	Apply(context.Context, Entry) error
	Snapshot(context.Context, string, string, string, string, int) (Snapshot, error)
}
type Service struct{ Store Store }

func New(store Store) Service { return Service{Store: store} }
func allow(scope Scope, facility, zone string, action security.Action) bool {
	return scope.TenantID != "" && facility != "" && zone != "" &&
		scope.Principal.Authenticated && scope.Principal.SubjectID != "" &&
		scope.Grant.SubjectID == scope.Principal.SubjectID && scope.Grant.TenantID == scope.TenantID &&
		security.Authorize(scope.Principal, scope.Grant, security.Resource{
			TenantID: scope.TenantID, FacilityID: facility, ZoneID: zone,
		}, action)
}
func validLot(l Lot) bool {
	switch l.Kind {
	case "SEED", "CLONE", "INPUT", "MATERIAL", "EQUIPMENT", "HARVEST":
	default:
		return false
	}
	switch l.Unit {
	case "g", "kg", "L", "mL", "each":
	default:
		return false
	}
	if (l.Kind == "SEED" || l.Kind == "CLONE" || l.Kind == "EQUIPMENT") && l.Unit != "each" {
		return false
	}
	if l.Kind == "HARVEST" && (l.HarvestID == "" || l.Unit != "g") {
		return false
	}
	if l.Kind != "HARVEST" && l.HarvestID != "" {
		return false
	}
	return l.ID != "" && l.FacilityID != "" && l.ZoneID != "" &&
		strings.TrimSpace(l.Label) == l.Label && len(l.Label) > 0 && len(l.Label) <= 160 &&
		!math.IsNaN(l.Opening) && !math.IsInf(l.Opening, 0) &&
		l.Opening >= 0 && l.Opening <= 1000000 &&
		(l.Unit != "each" || math.Trunc(l.Opening) == l.Opening)
}
func (s Service) Create(ctx context.Context, scope Scope, l Lot) error {
	if s.Store == nil || l.TenantID != scope.TenantID || !allow(scope, l.FacilityID, l.ZoneID, security.InventoryAdjust) {
		return ErrDenied
	}
	if !validLot(l) {
		return ErrInvalid
	}
	return s.Store.Create(ctx, l, scope.Principal.SubjectID)
}
func (s Service) Apply(ctx context.Context, scope Scope, e Entry, now time.Time) error {
	if s.Store == nil || e.TenantID != scope.TenantID || !allow(scope, e.FacilityID, e.ZoneID, security.InventoryAdjust) {
		return ErrDenied
	}
	if e.ID == "" || e.LotID == "" || e.Actor != scope.Principal.SubjectID ||
		e.IdempotencyKey == "" || len(e.IdempotencyKey) > 128 ||
		e.Source == "" || len(e.Source) > 128 || e.Reason == "" || len(e.Reason) > 500 ||
		e.OccurredAt.IsZero() || e.OccurredAt.Before(now.AddDate(-2, 0, 0)) ||
		e.OccurredAt.After(now.Add(5*time.Minute)) ||
		math.IsNaN(e.Quantity) || math.IsInf(e.Quantity, 0) || e.Quantity <= 0 || e.Quantity > 1000000 {
		return ErrInvalid
	}
	switch e.Kind {
	case "RECEIVE", "ADJUST_IN", "TRANSFER_IN", "ISSUE", "CONSUME", "ADJUST_OUT", "TRANSFER_OUT":
	default:
		return ErrInvalid
	}
	if e.Kind == "TRANSFER_IN" || e.Kind == "TRANSFER_OUT" {
		return ErrInvalid
	} // Transfers are atomic paired operations only.
	return s.Store.Apply(ctx, e)
}
func (s Service) Snapshot(ctx context.Context, scope Scope, facility, zone, lot string, limit int) (Snapshot, error) {
	if s.Store == nil || !allow(scope, facility, zone, security.View) {
		return Snapshot{}, ErrDenied
	}
	if lot == "" || limit < 1 || limit > 500 {
		return Snapshot{}, ErrInvalid
	}
	snap, err := s.Store.Snapshot(ctx, scope.TenantID, facility, zone, lot, limit+1)
	if err != nil {
		return Snapshot{}, err
	}
	if snap.Lot.TenantID != scope.TenantID || snap.Lot.FacilityID != facility || snap.Lot.ZoneID != zone ||
		snap.Lot.ID != lot || math.IsNaN(snap.Balance) || math.IsInf(snap.Balance, 0) ||
		snap.Balance < 0 || len(snap.Entries) > limit {
		return Snapshot{}, ErrDenied
	}
	for _, e := range snap.Entries {
		if e.TenantID != scope.TenantID || e.FacilityID != facility || e.ZoneID != zone || e.LotID != lot {
			return Snapshot{}, ErrDenied
		}
	}
	return snap, nil
}

// Jurisdiction templates describe internal reporting labels only and never certify or submit legal reports.
type Export struct {
	Jurisdiction  string
	Filename      string
	SchemaVersion string
	Certified     bool
	CSV           []byte
}

func cell(v string) string {
	v = strings.TrimSpace(v)
	if strings.HasPrefix(v, "=") || strings.HasPrefix(v, "+") || strings.HasPrefix(v, "-") || strings.HasPrefix(v, "@") {
		return "'" + v
	}
	return v
}
func (s Service) Export(ctx context.Context, scope Scope, facility, zone, lot, jurisdiction string, limit int) (Export, error) {
	if !allow(scope, facility, zone, security.AuditExport) {
		return Export{}, ErrDenied
	}
	switch jurisdiction {
	case "CA-SK", "CA-AB", "CA-NS", "CA-ON", "GENERIC":
	default:
		return Export{}, ErrInvalid
	}
	snap, err := s.Snapshot(ctx, scope, facility, zone, lot, limit)
	if err != nil {
		return Export{}, err
	}
	var output strings.Builder
	w := csv.NewWriter(&output)
	createdAt := ""
	if !snap.Lot.CreatedAt.IsZero() {
		createdAt = snap.Lot.CreatedAt.UTC().Format(time.RFC3339Nano)
	}
	for _, row := range [][]string{
		{"record_type", "jurisdiction_template", "lot_id", "kind", "unit", "balance", "event_id", "event_type", "quantity", "reason", "actor", "source", "occurred_at_utc", "reference_id", "harvest_id", "audit_status", "schema_version", "lot_created_at_utc", "lot_created_by"},
		{"BALANCE", jurisdiction, snap.Lot.ID, snap.Lot.Kind, snap.Lot.Unit, strconv.FormatFloat(snap.Balance, 'f', -1, 64), "", "", "", "", "", "", "", "", snap.Lot.HarvestID, "INTERNAL_UNVERIFIED", "GROW-V2-10-1", createdAt, cell(snap.Lot.CreatedBy)},
	} {
		if err = w.Write(row); err != nil {
			return Export{}, err
		}
	}
	for _, e := range snap.Entries {
		row := []string{"LEDGER", jurisdiction, lot, snap.Lot.Kind, snap.Lot.Unit, "", e.ID, e.Kind,
			strconv.FormatFloat(e.Quantity, 'f', -1, 64), cell(e.Reason), cell(e.Actor), cell(e.Source),
			e.OccurredAt.UTC().Format(time.RFC3339Nano), cell(e.ReferenceID), snap.Lot.HarvestID, "INTERNAL_UNVERIFIED", "GROW-V2-10-1", createdAt, cell(snap.Lot.CreatedBy)}
		if err = w.Write(row); err != nil {
			return Export{}, err
		}
	}
	w.Flush()
	if err = w.Error(); err != nil {
		return Export{}, fmt.Errorf("inventory export: %w", err)
	}
	return Export{Jurisdiction: jurisdiction, Filename: "grow-inventory-" + lot + ".csv", SchemaVersion: "GROW-V2-10-1", Certified: false, CSV: []byte(output.String())}, nil
}

var _ io.Writer = (*strings.Builder)(nil)

type TransferStore interface {
	Transfer(context.Context, Entry, Entry) error
}

// Transfer is an indivisible custody change between tenant-owned inventory lots.
// Source and destination both require an active inventory-adjust grant.
func (s Service) Transfer(ctx context.Context, scope Scope, from, to Entry, now time.Time) error {
	if s.Store == nil || from.TenantID != scope.TenantID || to.TenantID != scope.TenantID ||
		!allow(scope, from.FacilityID, from.ZoneID, security.InventoryAdjust) ||
		!allow(scope, to.FacilityID, to.ZoneID, security.InventoryAdjust) {
		return ErrDenied
	}
	if from.LotID == "" || to.LotID == "" || from.LotID == to.LotID ||
		from.ID == "" || to.ID == "" || from.ID == to.ID ||
		from.Kind != "TRANSFER_OUT" || to.Kind != "TRANSFER_IN" ||
		from.ReferenceID == "" || from.ReferenceID != to.ReferenceID ||
		from.IdempotencyKey == "" || to.IdempotencyKey == "" || from.IdempotencyKey == to.IdempotencyKey ||
		len(from.IdempotencyKey) > 128 || len(to.IdempotencyKey) > 128 ||
		from.Quantity <= 0 || from.Quantity != to.Quantity || math.IsNaN(from.Quantity) ||
		math.IsInf(from.Quantity, 0) || from.Quantity > 1000000 ||
		from.Actor != scope.Principal.SubjectID || to.Actor != scope.Principal.SubjectID ||
		from.Reason == "" || to.Reason == "" || len(from.Reason) > 500 || len(to.Reason) > 500 ||
		from.Source == "" || to.Source == "" || len(from.Source) > 128 || len(to.Source) > 128 ||
		from.OccurredAt.IsZero() || to.OccurredAt.IsZero() ||
		from.OccurredAt.After(now.Add(5*time.Minute)) || to.OccurredAt.After(now.Add(5*time.Minute)) ||
		from.OccurredAt.Before(now.AddDate(-2, 0, 0)) || to.OccurredAt.Before(now.AddDate(-2, 0, 0)) {
		return ErrInvalid
	}
	store, ok := s.Store.(TransferStore)
	if !ok {
		return ErrDenied
	}
	return store.Transfer(ctx, from, to)
}
