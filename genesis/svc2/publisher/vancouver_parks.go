package publisher

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "fmt"
 "math"
 "strings"
 "time"
)

// VancouverParksNamespace is a scoped source namespace. No source grant is
// created by this code or by a public licence; the operator must independently
// qualify a particular fetched extract and its acquisition channel.
const VancouverParksNamespace = "city-vancouver-open-data/parks"

// VancouverPark is the explicitly mapped, restricted intake representation of
// a City of Vancouver parks extract. It is NOT a claim about the live API's raw
// field names. A separately reviewed acquisition/mapping process must emit this
// schema, preserving the City's original park identifier as ParkID.
type VancouverPark struct {
 ParkID string `json:"park_id"`
 Name string `json:"name"`
 Latitude float64 `json:"latitude"`
 Longitude float64 `json:"longitude"`
}

type VancouverParksBatch struct {
 Dataset string `json:"dataset"`
 AcquisitionID string `json:"acquisition_id"`
 Revision string `json:"revision"`
 RetrievedAt time.Time `json:"retrieved_at"`
 Parks []VancouverPark `json:"parks"`
}

// CandidateIntake exposes no approval, canonical mutation or generation
// promotion. A GuardedLedger can implement it, with independently provisioned
// source policy. A nil or untrusted source grant fails closed.
type CandidateIntake interface { ImportCandidate(context.Context,Candidate) error }

// StageVancouverParks stages pending candidates only. All rows are validated
// before staging; incomplete batches are never interpreted as deletions. This
// does not retain canonical payloads or constitute publish-ready evidence.
func StageVancouverParks(ctx context.Context, intake CandidateIntake, batch VancouverParksBatch) (int,error) {
 if intake==nil || batch.Dataset!="parks" || strings.TrimSpace(batch.AcquisitionID)=="" || strings.TrimSpace(batch.Revision)=="" || batch.RetrievedAt.IsZero() || len(batch.Parks)==0 || len(batch.Parks)>1000 {return 0,ErrInvalid}
 seen:=make(map[string]bool,len(batch.Parks))
 candidates:=make([]Candidate,0,len(batch.Parks))
 for _,p:=range batch.Parks {
  id:=strings.TrimSpace(p.ParkID)
  name:=strings.TrimSpace(p.Name)
  if id=="" || id!=p.ParkID || strings.ContainsAny(id,"/\\\n\r\t") || name=="" || math.IsNaN(p.Latitude) || math.IsNaN(p.Longitude) || math.IsInf(p.Latitude,0) || math.IsInf(p.Longitude,0) || p.Latitude<49.0 || p.Latitude>49.4 || p.Longitude< -123.35 || p.Longitude> -122.9 || seen[id] {return 0,ErrInvalid}
  seen[id]=true
  raw,err:=json.Marshal(p);if err!=nil{return 0,err}
  rawHash:=sha256.Sum256(raw)
  normalized,err:=json.Marshal(struct{ParkID,Name string;Latitude,Longitude float64}{id,name,p.Latitude,p.Longitude});if err!=nil{return 0,err}
  normHash:=sha256.Sum256(normalized)
  c:=Candidate{ID:"vancouver-park:"+id,Kind:Place,Source:SourceEvidence{
   Namespace:VancouverParksNamespace,RecordID:id,Revision:batch.Revision,ManifestID:batch.AcquisitionID,
   TermsRef:"https://vancouver.ca/open-government-licence",
   AttributionRef:"https://opendata.vancouver.ca/explore/dataset/parks/",
   RetrievedAt:batch.RetrievedAt,PayloadSHA256:hex.EncodeToString(rawHash[:]),
  },NormalizedSHA256:hex.EncodeToString(normHash[:]),ExpectedVersion:0}
  if err=c.Validate();err!=nil{return 0,fmt.Errorf("candidate %q: %w",id,err)}
  candidates=append(candidates,c)
 }
 count:=0
 for _,c:=range candidates {
  if err:=intake.ImportCandidate(ctx,c);err!=nil{return count,fmt.Errorf("stage %s: %w",c.ID,err)}
  count++
 }
 return count,nil
}
