package travelapp

import (
 "context"
 "database/sql"
 "errors"
 "time"
)

// SQLTripShareGrants uses migrations/002_travel_trip_shares.sql and a
// separately provisioned database/sql PostgreSQL connection. Never log tokens.
type SQLTripShareGrants struct { DB *sql.DB }
func (s *SQLTripShareGrants) Issue(ctx context.Context,owner,id,hash string,expiry time.Time)error {
 if s==nil||s.DB==nil||authorizedTripOwner(owner)!=nil||!validPlaceID(id)||len(hash)!=64||!expiry.After(time.Now().UTC()){return ErrTripShareUnavailable}
 // The insertion and current visibility/owner check are a single statement.
 result,err:=s.DB.ExecContext(ctx,`INSERT INTO travel_trip_shares(token_hash,trip_id,owner_id,expires_at) SELECT $1,id,owner_id,$4 FROM travel_trips WHERE id=$2 AND owner_id=$3 AND visibility='UNLISTED'`,hash,id,owner,expiry)
 if err!=nil{return ErrTripShareUnavailable};count,err:=result.RowsAffected();if err!=nil||count!=1{return ErrTripShareUnavailable};return nil
}
func (s *SQLTripShareGrants) Revoke(ctx context.Context,owner,id string)error {
 if s==nil||s.DB==nil||authorizedTripOwner(owner)!=nil||!validPlaceID(id){return ErrTripShareUnavailable}
 _,err:=s.DB.ExecContext(ctx,`DELETE FROM travel_trip_shares WHERE owner_id=$1 AND trip_id=$2`,owner,id);return err
}
func (s *SQLTripShareGrants) Resolve(ctx context.Context,hash string)(string,string,error){
 if s==nil||s.DB==nil||len(hash)!=64{return "","",ErrTripNotFound}
 var owner,id string
 err:=s.DB.QueryRowContext(ctx,`SELECT g.owner_id,g.trip_id FROM travel_trip_shares g JOIN travel_trips t ON t.id=g.trip_id AND t.owner_id=g.owner_id WHERE g.token_hash=$1 AND g.expires_at>clock_timestamp() AND t.visibility='UNLISTED'`,hash).Scan(&owner,&id)
 if err!=nil {if errors.Is(err,sql.ErrNoRows){return "","",ErrTripNotFound};return "","",ErrTripShareUnavailable}
 return owner,id,nil
}
var _ TripShareGrantStore = (*SQLTripShareGrants)(nil)
