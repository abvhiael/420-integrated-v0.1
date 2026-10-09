package dashboard

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/420integrated/420-integrated/grow/security"
)

// SQLReader is an app-private read projection. Database permissions must be the
// unprivileged Grow runtime account, with forced tenant row-level security.
type SQLReader struct{ DB *sql.DB }

func sectionQuery(section string) (string, error) {
	const where = " WHERE tenant_id=$1::uuid AND ($2='' OR facility_id=NULLIF($2,'')::uuid) AND ($3='' OR zone_id=NULLIF($3,'')::uuid)"
	switch section {
	case "overview", "facilities":
		return "SELECT facility_id::text,name,'Private facility', 'ACTIVE' FROM grow_private.facilities WHERE tenant_id=$1::uuid AND ($2='' OR facility_id=NULLIF($2,'')::uuid) ORDER BY facility_id LIMIT 100", nil
	case "plants":
		return "SELECT plant_id::text,label,coalesce(cultivar_id::text,'No cultivar assigned'),state FROM grow_private.plants" + where + " ORDER BY plant_id LIMIT 100", nil
	case "environment":
		return "SELECT observation_id::text,kind,reading::text||' '||unit||' at '||measured_at::text,source FROM grow_private.observations" + where + " ORDER BY measured_at DESC,observation_id LIMIT 100", nil
	case "equipment":
		return "SELECT device_id::text,device_type,'Monitored equipment; physical override required','REGISTERED' FROM grow_private.equipment" + where + " ORDER BY device_id LIMIT 100", nil
	case "cultivation":
		return "SELECT event_id::text,metric,amount::text||' '||unit||' at '||occurred_at::text,kind FROM grow_private.cultivation_events" + where + " ORDER BY occurred_at DESC,event_id LIMIT 100", nil
	case "harvests":
		return "SELECT harvest_id::text,'Observed harvest',weight_grams::text||' g dry at '||harvested_at::text,'OBSERVED' FROM grow_private.harvest_records" + where + " ORDER BY harvested_at DESC,harvest_id LIMIT 100", nil
	case "inventory":
		return "SELECT lot_id::text,label,balance::text||' '||unit,kind FROM grow_private.inventory_lots_v2" + where + " ORDER BY lot_id LIMIT 100", nil
	case "advice":
		return "SELECT recommendation_id::text,'Human review required',text,confidence FROM grow_private.ai_recommendations" + where + " ORDER BY created_at DESC,recommendation_id LIMIT 100", nil
	case "notifications":
		return "SELECT event_id::text,kind,'Private provider outbox; acceptance is not delivery',state FROM grow_private.integration_outbox" + where + " ORDER BY created_at DESC,event_id LIMIT 100", nil
	default:
		return "", errors.New("unsupported dashboard section")
	}
}

func (s SQLReader) List(r *http.Request, session Session, section string) ([]Item, error) {
	if s.DB == nil || session.TenantID == "" || session.SubjectID == "" {
		return nil, errors.New("unauthorized dashboard")
	}
	query, err := sectionQuery(section)
	if err != nil {
		return nil, err
	}
	tx, err := s.DB.BeginTx(r.Context(), nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(r.Context(), "SELECT set_config('grow.tenant_id',$1,true)", session.TenantID); err != nil {
		return nil, err
	}
	var role string
	var facility, zone string
	err = tx.QueryRowContext(r.Context(), `SELECT role,coalesce(facility_id::text,''),coalesce(zone_id::text,'')
FROM grow_private.memberships
WHERE tenant_id=$1::uuid AND subject_id=$2 AND state='ACTIVE'`, session.TenantID, session.SubjectID).Scan(&role, &facility, &zone)
	if err != nil {
		return nil, errors.New("active membership required")
	}
	action := security.View
	if section == "equipment" {
		action = security.EquipmentObserve
	}
	if !security.Authorize(security.Principal{SubjectID: session.SubjectID, Authenticated: true},
		security.Grant{SubjectID: session.SubjectID, TenantID: session.TenantID, FacilityID: facility, ZoneID: zone, State: security.Active, Role: security.Role(role)},
		security.Resource{TenantID: session.TenantID, FacilityID: facility, ZoneID: zone}, action) {
		return nil, errors.New("dashboard membership denied")
	}
	args := []any{session.TenantID, facility, zone}
	if section == "overview" || section == "facilities" {
		args = args[:2]
	}
	rows, err := tx.QueryContext(r.Context(), query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Item, 0)
	for rows.Next() {
		var item Item
		if err = rows.Scan(&item.ID, &item.Title, &item.Summary, &item.State); err != nil {
			return nil, err
		}
		item.TenantID = session.TenantID
		items = append(items, item)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if err = rows.Close(); err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return items, nil
}
