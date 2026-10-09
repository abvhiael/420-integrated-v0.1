package dashboard

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/grow/assistance"
	"github.com/420integrated/420-integrated/grow/cultivation"
	"github.com/420integrated/420-integrated/grow/facility"
	"github.com/420integrated/420-integrated/grow/harvest"
	"github.com/420integrated/420-integrated/grow/inventory"
	"github.com/420integrated/420-integrated/grow/plants"
	"github.com/420integrated/420-integrated/grow/security"
)

type ActionInput struct {
	Operation    string  `json:"operation"`
	FacilityID   string  `json:"facilityId"`
	ZoneID       string  `json:"zoneId"`
	ParentID     string  `json:"parentId"`
	ID           string  `json:"id"`
	SourceID     string  `json:"sourceId"`
	Label        string  `json:"label"`
	Kind         string  `json:"kind"`
	State        string  `json:"state"`
	Metric       string  `json:"metric"`
	Unit         string  `json:"unit"`
	Amount       float64 `json:"amount"`
	Reason       string  `json:"reason"`
	Revision     int64   `json:"revision"`
	Jurisdiction string  `json:"jurisdiction"`
	RequestID    string  `json:"requestId"`
}

type SQLActions struct{ DB *sql.DB }

func uuidV4() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	b[6] = (b[6] & 15) | 64
	b[8] = (b[8] & 63) | 128
	const hex = "0123456789abcdef"
	var o [36]byte
	positions := 0
	for i, v := range b {
		if i == 4 || i == 6 || i == 8 || i == 10 {
			o[positions] = '-'
			positions++
		}
		o[positions] = hex[v>>4]
		o[positions+1] = hex[v&15]
		positions += 2
	}
	return string(o[:]), nil
}

func (a SQLActions) grant(r *http.Request, session Session) (security.Grant, error) {
	if a.DB == nil || session.TenantID == "" || session.SubjectID == "" {
		return security.Grant{}, errors.New("no private database")
	}
	tx, err := a.DB.BeginTx(r.Context(), nil)
	if err != nil {
		return security.Grant{}, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(r.Context(), "SELECT set_config('grow.tenant_id',$1,true)", session.TenantID); err != nil {
		return security.Grant{}, err
	}
	var role string
	var facilityID, zoneID sql.NullString
	err = tx.QueryRowContext(r.Context(), `SELECT role,facility_id::text,zone_id::text
FROM grow_private.memberships
WHERE tenant_id=$1::uuid AND subject_id=$2 AND state='ACTIVE'`, session.TenantID, session.SubjectID).
		Scan(&role, &facilityID, &zoneID)
	if err != nil {
		return security.Grant{}, errors.New("active membership required")
	}
	grant := security.Grant{TenantID: session.TenantID, SubjectID: session.SubjectID, Role: security.Role(role), State: security.Active}
	if facilityID.Valid {
		grant.FacilityID = facilityID.String
	}
	if zoneID.Valid {
		grant.ZoneID = zoneID.String
	}
	if err = tx.Commit(); err != nil {
		return security.Grant{}, err
	}
	return grant, nil
}
func (a SQLActions) Execute(r *http.Request, session Session, section string, body json.RawMessage) (ActionResult, error) {
	if a.DB == nil || len(body) > 8192 {
		return ActionResult{}, errors.New("private actions unavailable")
	}
	decoder := json.NewDecoder(strings.NewReader(string(body)))
	decoder.DisallowUnknownFields()
	var in ActionInput
	if err := decoder.Decode(&in); err != nil {
		return ActionResult{}, err
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return ActionResult{}, errors.New("trailing JSON")
	}
	if in.Operation == "" || len(in.Label) > 160 || len(in.Reason) > 1000 || !tenantUUID.MatchString(in.RequestID) {
		return ActionResult{}, errors.New("invalid private action")
	}
	grant, err := a.grant(r, session)
	if err != nil {
		return ActionResult{}, err
	}
	scope := security.Principal{SubjectID: session.SubjectID, Authenticated: true}
	ctx := r.Context()
	now := time.Now().UTC()
	id := in.RequestID
	switch section {
	case "facilities":
		svc := facility.New(facility.SQLStore{DB: a.DB})
		s := facility.Scope{TenantID: session.TenantID, Principal: scope, Membership: grant}
		switch in.Operation {
		case "create":
			kind := facility.Kind(in.Kind)
			parentID := in.ParentID
			fid := in.FacilityID
			if kind == facility.Facility {
				parentID = ""
				fid = ""
			}
			_, err = svc.Create(ctx, s, facility.Record{TenantID: session.TenantID, ID: id, ParentID: parentID,
				FacilityID: fid, Kind: kind, Name: in.Label})
		case "rename":
			_, err = svc.Rename(ctx, s, facility.Kind(in.Kind), in.ID, in.Label, in.Revision)
		default:
			err = errors.New("unsupported facility action")
		}
	case "plants":
		svc := plants.New(plants.SQLStore{DB: a.DB})
		s := plants.Scope{TenantID: session.TenantID, Principal: scope, Membership: grant}
		switch in.Operation {
		case "create":
			_, err = svc.Create(ctx, s, plants.Plant{TenantID: session.TenantID, FacilityID: in.FacilityID,
				ZoneID: in.ZoneID, ID: id, Label: in.Label, State: plants.Stage(in.State)})
		case "transition":
			_, err = svc.Transition(ctx, s, in.ID, plants.Stage(in.State), in.Revision)
		default:
			err = errors.New("unsupported plant action")
		}
	case "cultivation":
		if in.Operation != "record" {
			err = errors.New("unsupported cultivation action")
			break
		}
		svc := cultivation.New(cultivation.SQLStore{DB: a.DB})
		err = svc.Append(ctx, cultivation.Scope{TenantID: session.TenantID, Principal: scope, Grant: grant},
			cultivation.Event{TenantID: session.TenantID, FacilityID: in.FacilityID, ZoneID: in.ZoneID,
				ID: id, Kind: in.Kind, Metric: in.Metric, Unit: in.Unit, Amount: in.Amount, Notes: in.Reason,
				Actor: session.SubjectID, Source: "dashboard-web", IdempotencyKey: in.RequestID, OccurredAt: now}, now)
	case "harvests":
		if in.Operation != "record" {
			err = errors.New("unsupported harvest action")
			break
		}
		svc := harvest.New(harvest.SQLStore{DB: a.DB})
		err = svc.Record(ctx, harvest.Scope{TenantID: session.TenantID, Principal: scope, Grant: grant},
			harvest.Record{TenantID: session.TenantID, FacilityID: in.FacilityID, ZoneID: in.ZoneID,
				PlantID: in.SourceID, ID: id, WeightGrams: in.Amount, Actor: session.SubjectID,
				Source: "dashboard-web", IdempotencyKey: in.RequestID, HarvestedAt: now}, now)
	case "inventory":
		svc := inventory.New(inventory.SQLStore{DB: a.DB})
		s := inventory.Scope{TenantID: session.TenantID, Principal: scope, Grant: grant}
		switch in.Operation {
		case "create":
			err = svc.Create(ctx, s, inventory.Lot{TenantID: session.TenantID, FacilityID: in.FacilityID,
				ZoneID: in.ZoneID, ID: id, Kind: in.Kind, Unit: in.Unit, Label: in.Label, Opening: in.Amount})
		case "adjust":
			err = svc.Apply(ctx, s, inventory.Entry{TenantID: session.TenantID, FacilityID: in.FacilityID,
				ZoneID: in.ZoneID, LotID: in.SourceID, ID: id, Kind: in.Kind, Quantity: in.Amount,
				Reason: in.Reason, Actor: session.SubjectID, Source: "dashboard-web",
				IdempotencyKey: in.RequestID, OccurredAt: now}, now)
		case "export":
			out, e := svc.Export(ctx, s, in.FacilityID, in.ZoneID, in.SourceID, in.Jurisdiction, 500)
			if e != nil {
				return ActionResult{}, e
			}
			return ActionResult{CSV: out.CSV, Filename: out.Filename}, nil
		default:
			err = errors.New("unsupported inventory action")
		}
	case "advice":
		if in.Operation != "review" {
			err = errors.New("unsupported review action")
			break
		}
		svc := assistance.New(assistance.SQLStore{DB: a.DB})
		err = svc.Decide(ctx, assistance.Scope{TenantID: session.TenantID, Principal: scope, Grant: grant},
			assistance.Review{TenantID: session.TenantID, FacilityID: in.FacilityID, ZoneID: in.ZoneID,
				RecommendationID: in.SourceID, ID: id, Actor: session.SubjectID, Decision: in.State,
				Reason: in.Reason, ReviewedAt: now}, now)
	default:
		err = errors.New("unsupported or unsafe action")
	}
	if err != nil {
		return ActionResult{}, err
	}
	return ActionResult{}, nil
}
