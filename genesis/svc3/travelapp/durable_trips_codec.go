package travelapp

import (
 "bytes"
 "encoding/json"
 "errors"
 "io"
)

// tripDiskRecord deliberately keeps the owner identifier in the private disk
// format while Trip.OwnerID remains excluded from public/API JSON encoding.
type tripDiskRecord struct {
 Trip
 OwnerID string `json:"ownerId"`
}

func (s tripSnapshot) MarshalJSON()([]byte,error){
 records:=make([]tripDiskRecord,0,len(s.Trips))
 for _,trip:=range s.Trips{records=append(records,tripDiskRecord{Trip:trip,OwnerID:trip.OwnerID})}
 return json.Marshal(struct{Version int `json:"version"`; Trips []tripDiskRecord `json:"trips"`}{Version:s.Version,Trips:records})
}
func (s *tripSnapshot) UnmarshalJSON(data []byte)error{
 var disk struct{Version int `json:"version"`;Trips []tripDiskRecord `json:"trips"`}
 dec:=json.NewDecoder(bytes.NewReader(data));dec.DisallowUnknownFields()
 if err:=dec.Decode(&disk);err!=nil{return err}
 var remainder any
 if err:=dec.Decode(&remainder);!errors.Is(err,io.EOF){return errors.New("trailing private trip record data")}
 s.Version=disk.Version;s.Trips=make([]Trip,0,len(disk.Trips))
 for _,record:=range disk.Trips{trip:=record.Trip;trip.OwnerID=record.OwnerID;s.Trips=append(s.Trips,trip)}
 return nil
}
