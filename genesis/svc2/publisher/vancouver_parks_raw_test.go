package publisher

import (
 "context"
 "encoding/json"
 "errors"
 "strings"
 "testing"
 "time"
)

// These fields and values are from the supplied Vancouver parks export, not
// synthetic park IDs or the previously assumed mapped intake schema.
const actualParkRows = `[{"parkid":1,"name":"Arbutus Village Park","official":1,"neighbourhoodname":"Arbutus-Ridge","googlemapdest":{"lon":-123.15525,"lat":49.249783}},{"parkid":204,"name":"Rosemont Park","official":0,"neighbourhoodname":"Killarney","googlemapdest":{"lon":-123.040816,"lat":49.215746}}]`
func TestMapVancouverRawExportAndPrivateRetention(t *testing.T){
 batch,records,err:=MapVancouverParksRaw([]byte(actualParkRows),"private-acquisition","raw-checksum",time.Date(2026,9,21,0,0,0,0,time.UTC))
 if err!=nil||len(records)!=2||len(batch.Parks)!=2{t.Fatalf("real schema mapping: %v",err)}
 if batch.Parks[0].ParkID!="1"||records[0].CanonicalCandidateID!="vancouver-park:1"||records[0].Neighbourhood!="Arbutus-Ridge"||!records[0].Official||records[1].Official{t.Fatalf("lost raw fields: %+v",records)}
 if !validDigest(records[0].RawRecordSHA256)||!validDigest(records[0].NormalizedSHA256){t.Fatal("missing private payload digests")}
 encoded,err:=json.Marshal(records);if err!=nil{t.Fatal(err)};if !strings.Contains(string(encoded),"Rosemont Park"){t.Fatal("normalized private payload not serializable")}
 sink:=&parksIntake{};n,err:=StageVancouverParks(context.Background(),sink,batch)
 if err!=nil||n!=2||len(sink.records)!=2{t.Fatalf("pending-only staging: %d %v",n,err)}
 for i,c:=range sink.records{if c.NormalizedSHA256!=records[i].NormalizedSHA256{t.Fatal("retained payload digest does not match candidate")}}
}
func TestMapVancouverRawExportRejectsBadSchemaBeforeStaging(t *testing.T){
 cases:=[]string{
  `{}`,`[]`,`[{"parkid":1,"name":"Park","official":1,"neighbourhoodname":"Downtown","googlemapdest":{"lon":-123.1,"lat":49.2}}] {}`,
  `[{"parkid":1,"name":"Park","official":1,"neighbourhoodname":"Downtown","googlemapdest":{"lon":-123.1,"lat":49.2}},{"parkid":1,"name":"Other","official":1,"neighbourhoodname":"Downtown","googlemapdest":{"lon":-123.1,"lat":49.2}}]`,
  `[{"parkid":1,"name":"Park","official":1,"neighbourhoodname":"Downtown","googlemapdest":{"lon":-123.1}}]`,
  `[{"parkid":1,"name":"Park","official":1,"neighbourhoodname":"Downtown","googlemapdest":{"lon":-123.1,"lat":50.0}}]`,
 }
 for _,v:=range cases{b,p,err:=MapVancouverParksRaw([]byte(v),"acquisition","digest",time.Now());if err==nil||len(p)!=0||len(b.Parks)!=0{t.Fatalf("invalid raw accepted: %s",v)}}
 if _,_,err:=MapVancouverParksRaw([]byte(actualParkRows),"","checksum",time.Now());!errors.Is(err,ErrInvalid){t.Fatal("unidentified acquisition accepted")}
}
