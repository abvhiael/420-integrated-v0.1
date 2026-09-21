package travelapp

import (
 "context"
 "database/sql"
 "encoding/json"
 "errors"
 "fmt"
 "strings"
 "time"
)

// SQLTripRepository uses the GEN-SVC-3.11.4 PostgreSQL migration. The caller
// supplies a configured PostgreSQL database/sql driver and a successfully
// migrated database; opening or migrating an unknown database is not implicit.
// All private lookups and mutations include the verified owner in the SQL WHERE.
type SQLTripRepository struct { DB *sql.DB }

func NewSQLTripRepository(db *sql.DB) (*SQLTripRepository,error) {
 if db==nil {return nil,errors.New("Trips database required")}
 return &SQLTripRepository{DB:db},nil
}
func (s *SQLTripRepository) db()(*sql.DB,error){if s==nil||s.DB==nil{return nil,errors.New("Trips database unavailable")};return s.DB,nil}

const tripColumns = "id, owner_id, title, visibility, place_ids, event_ids, created_at, updated_at"

func readSQLTrip(scanner interface{Scan(...any)error})(Trip,error){
 var t Trip;var visibility string;var places,events []byte
 if err:=scanner.Scan(&t.ID,&t.OwnerID,&t.Title,&visibility,&places,&events,&t.CreatedAt,&t.UpdatedAt);err!=nil{return Trip{},err}
 t.Visibility=TripVisibility(visibility)
 if err:=json.Unmarshal(places,&t.PlaceIDs);err!=nil{return Trip{},fmt.Errorf("decode places: %w",err)}
 if err:=json.Unmarshal(events,&t.EventIDs);err!=nil{return Trip{},fmt.Errorf("decode events: %w",err)}
 if err:=validateTrip(t);err!=nil{return Trip{},err}
 return copyTrip(t),nil
}
func tripJSON(ids []string)([]byte,error){if ids==nil{ids=[]string{}};return json.Marshal(ids)}
func authorizedTripOwner(owner string)error {if strings.TrimSpace(owner)==""||strings.TrimSpace(owner)!=owner||len(owner)>256{return ErrTripUnauthorized};return nil}

func (s *SQLTripRepository) Create(ctx context.Context,owner string,t Trip)(Trip,error){
 db,err:=s.db();if err!=nil{return Trip{},err};if err:=ctx.Err();err!=nil{return Trip{},err}
 if err:=authorizedTripOwner(owner);err!=nil{return Trip{},err}
 t.OwnerID=owner;if t.Visibility==""{t.Visibility=TripPrivate};if err:=validateTrip(t);err!=nil{return Trip{},err}
 places,_:=tripJSON(t.PlaceIDs);events,_:=tripJSON(t.EventIDs)
 // ON CONFLICT catches duplicate globally unique IDs without making a
 // cross-owner ID observable through any read or edit operation.
 row:=db.QueryRowContext(ctx,`INSERT INTO travel_trips (id,owner_id,title,visibility,place_ids,event_ids) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING RETURNING `+tripColumns,t.ID,owner,t.Title,string(t.Visibility),string(places),string(events))
 result,err:=readSQLTrip(row);if errors.Is(err,sql.ErrNoRows){return Trip{},ErrTripConflict};return result,err
}
func (s *SQLTripRepository) GetOwned(ctx context.Context,owner,id string)(Trip,error){
 db,err:=s.db();if err!=nil{return Trip{},err};if err:=authorizedTripOwner(owner);err!=nil{return Trip{},err}
 t,err:=readSQLTrip(db.QueryRowContext(ctx,`SELECT `+tripColumns+` FROM travel_trips WHERE owner_id=$1 AND id=$2`,owner,id))
 if errors.Is(err,sql.ErrNoRows){return Trip{},ErrTripNotFound};return t,err
}
func (s *SQLTripRepository) ListOwned(ctx context.Context,owner string)([]Trip,error){
 db,err:=s.db();if err!=nil{return nil,err};if err:=authorizedTripOwner(owner);err!=nil{return nil,err}
 rows,err:=db.QueryContext(ctx,`SELECT `+tripColumns+` FROM travel_trips WHERE owner_id=$1 ORDER BY id LIMIT 1000`,owner);if err!=nil{return nil,err};defer rows.Close()
 out:=make([]Trip,0);for rows.Next(){t,err:=readSQLTrip(rows);if err!=nil{return nil,err};out=append(out,t)};if err:=rows.Err();err!=nil{return nil,err};return out,nil
}
func (s *SQLTripRepository) Replace(ctx context.Context,owner string,t Trip)(Trip,error){
 db,err:=s.db();if err!=nil{return Trip{},err};if err:=authorizedTripOwner(owner);err!=nil{return Trip{},err}
 t.OwnerID=owner;if err:=validateTrip(t);err!=nil{return Trip{},err}
 places,_:=tripJSON(t.PlaceIDs);events,_:=tripJSON(t.EventIDs)
 // Optional optimistic concurrency: caller must supply the timestamp last
 // observed from GetOwned/ListOwned. A zero timestamp never authorizes edits.
 if t.UpdatedAt.IsZero(){return Trip{},ErrTripConflict}
 row:=db.QueryRowContext(ctx,`UPDATE travel_trips SET title=$3, visibility=$4, place_ids=$5, event_ids=$6, updated_at=clock_timestamp() WHERE owner_id=$1 AND id=$2 AND updated_at=$7 RETURNING `+tripColumns,owner,t.ID,t.Title,string(t.Visibility),string(places),string(events),t.UpdatedAt)
 result,err:=readSQLTrip(row);if errors.Is(err,sql.ErrNoRows){return Trip{},ErrTripNotFound};return result,err
}
func (s *SQLTripRepository) Delete(ctx context.Context,owner,id string)error {
 db,err:=s.db();if err!=nil{return err};if err:=authorizedTripOwner(owner);err!=nil{return err}
 result,err:=db.ExecContext(ctx,`DELETE FROM travel_trips WHERE owner_id=$1 AND id=$2`,owner,id);if err!=nil{return err}
 count,err:=result.RowsAffected();if err!=nil{return err};if count==0{return ErrTripNotFound};return nil
}
// ListPublic is a candidate projection only. HTTP consumers MUST re-resolve
// every referenced place/event against current publication permissions.
func (s *SQLTripRepository) ListPublic(ctx context.Context)([]Trip,error){
 db,err:=s.db();if err!=nil{return nil,err}
 rows,err:=db.QueryContext(ctx,`SELECT `+tripColumns+` FROM travel_trips WHERE visibility='PUBLIC' ORDER BY id LIMIT 1000`);if err!=nil{return nil,err};defer rows.Close()
 out:=make([]Trip,0);for rows.Next(){t,err:=readSQLTrip(rows);if err!=nil{return nil,err};out=append(out,t)};if err:=rows.Err();err!=nil{return nil,err};return out,nil
}

// SQLTripMigrationVersion is pinned to the deployed migration rather than
// auto-applying privileged DDL from an HTTP-serving process.
const SQLTripMigrationVersion = 1
var _ TripRepository = (*SQLTripRepository)(nil)
var _ = time.UTC
