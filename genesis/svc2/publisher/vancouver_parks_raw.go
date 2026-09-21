package publisher

import (
 "bytes"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "errors"
 "fmt"
 "io"
 "math"
 "strconv"
 "strings"
 "time"
)

// VancouverParkPayload is a private normalized record retained alongside the
// exact raw acquisition. It grants no rights and cannot itself authorize a write.
type VancouverParkPayload struct {
 CanonicalCandidateID string `json:"canonical_candidate_id"`
 SourceParkID string `json:"source_park_id"`
 Name string `json:"name"`
 Latitude float64 `json:"latitude"`
 Longitude float64 `json:"longitude"`
 Official bool `json:"official"`
 Neighbourhood string `json:"neighbourhood"`
 RawRecordSHA256 string `json:"raw_record_sha256"`
 NormalizedSHA256 string `json:"normalized_sha256"`
}

type vancouverRawPark struct {
 ParkID json.Number `json:"parkid"`
 Name string `json:"name"`
 Official *int `json:"official"`
 Neighbourhood string `json:"neighbourhoodname"`
 GoogleMapDest *struct {Lon *float64 `json:"lon"`;Lat *float64 `json:"lat"`} `json:"googlemapdest"`
}

// MapVancouverParksRaw accepts the *actual* parks JSON export's top-level array
// and raw parkid/googlemapdest schema. The caller must independently retain and
// qualify the complete acquisition; this function does not assert completeness.
// All records are validated before a batch can be staged. Neither mapping nor
// retention is approval, canonical application, or public publication.
func MapVancouverParksRaw(raw []byte, acquisitionID, revision string, retrievedAt time.Time)(VancouverParksBatch,[]VancouverParkPayload,error){
 empty:=VancouverParksBatch{}
 if len(raw)==0||len(raw)>32<<20||strings.TrimSpace(acquisitionID)==""||strings.TrimSpace(revision)==""||retrievedAt.IsZero(){return empty,nil,ErrInvalid}
 dec:=json.NewDecoder(bytes.NewReader(raw));dec.UseNumber()
 var rows []json.RawMessage
 if err:=dec.Decode(&rows);err!=nil||len(rows)==0||len(rows)>1000{return empty,nil,ErrInvalid}
 var trailing any;if err:=dec.Decode(&trailing);!errors.Is(err,io.EOF){return empty,nil,ErrInvalid}
 batch:=VancouverParksBatch{Dataset:"parks",AcquisitionID:acquisitionID,Revision:revision,RetrievedAt:retrievedAt,Parks:make([]VancouverPark,0,len(rows))}
 payloads:=make([]VancouverParkPayload,0,len(rows));seen:=map[string]bool{}
 for i,record:=range rows{
  var row vancouverRawPark
  if err:=json.Unmarshal(record,&row);err!=nil{return empty,nil,fmt.Errorf("raw park %d: %w",i,ErrInvalid)}
  if row.ParkID==""||strings.ContainsAny(string(row.ParkID),".eE+-") {return empty,nil,ErrInvalid}
  id,err:=strconv.ParseUint(string(row.ParkID),10,64)
  if err!=nil||id==0||row.Official==nil||(*row.Official!=0&&*row.Official!=1)||row.GoogleMapDest==nil||row.GoogleMapDest.Lat==nil||row.GoogleMapDest.Lon==nil{return empty,nil,ErrInvalid}
  parkID:=strconv.FormatUint(id,10)
  if seen[parkID]{return empty,nil,ErrConflict};seen[parkID]=true
  lat,lon:=*row.GoogleMapDest.Lat,*row.GoogleMapDest.Lon
  if math.IsNaN(lat)||math.IsNaN(lon)||math.IsInf(lat,0)||math.IsInf(lon,0)||lat<49.0||lat>49.4||lon< -123.35||lon> -122.9||strings.TrimSpace(row.Name)==""||strings.TrimSpace(row.Neighbourhood)=="" {return empty,nil,ErrInvalid}
  park:=VancouverPark{ParkID:parkID,Name:strings.TrimSpace(row.Name),Latitude:lat,Longitude:lon}
  normalized,err:=json.Marshal(struct{ParkID,Name string;Latitude,Longitude float64}{park.ParkID,park.Name,park.Latitude,park.Longitude});if err!=nil{return empty,nil,err}
  rawHash:=sha256.Sum256(record);normHash:=sha256.Sum256(normalized)
  batch.Parks=append(batch.Parks,park)
  payloads=append(payloads,VancouverParkPayload{CanonicalCandidateID:"vancouver-park:"+parkID,SourceParkID:parkID,Name:park.Name,Latitude:lat,Longitude:lon,Official:*row.Official==1,Neighbourhood:row.Neighbourhood,RawRecordSHA256:hex.EncodeToString(rawHash[:]),NormalizedSHA256:hex.EncodeToString(normHash[:])})
 }
 return batch,payloads,nil
}
