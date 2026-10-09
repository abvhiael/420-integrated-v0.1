package api

import (
 "encoding/json"
 "io"
 "os"
 "strconv"
)

const maxScienceSnapshotBytes int64 = 1 << 20

// ScienceSnapshotReader reads a bounded, operator-provisioned projection snapshot.
// It cannot validate provider signatures or promote external points to native rewards.
// Its output is intentionally UNVERIFIED until a canonical event/index pipeline exists.
type ScienceSnapshotReader struct { Path string }

func (s ScienceSnapshotReader) ExternalScience(chainID string, limit uint32) (SciencePage,error) {
 if s.Path=="" || limit==0 || limit>100 {return SciencePage{},ErrScienceSourceUnavailable}
 file,err:=os.Open(s.Path);if err!=nil{return SciencePage{},ErrScienceSourceUnavailable};defer file.Close()
 stat,err:=file.Stat();if err!=nil||!stat.Mode().IsRegular()||stat.Size()>maxScienceSnapshotBytes{return SciencePage{},ErrScienceSourceUnavailable}
 b,err:=io.ReadAll(io.LimitReader(file,maxScienceSnapshotBytes+1));if err!=nil||int64(len(b))>maxScienceSnapshotBytes{return SciencePage{},ErrScienceSourceUnavailable}
 var page SciencePage
 if err=json.Unmarshal(b,&page);err!=nil{return SciencePage{},ErrScienceSourceUnavailable}
 if page.SchemaVersion!="420-science-read-v1"||page.ChainID!=chainID||page.Authoritative||page.RewardEligible||page.Items==nil||page.Total<len(page.Items)||strconv.FormatUint(420,10)!=chainID{return SciencePage{},ErrScienceSourceUnavailable}
 for i:=range page.Items{
  v:=&page.Items[i]
  if v.ChainID!=chainID||v.Authoritative||v.RewardEligible||v.Amount420!=nil||v.Provider!="BOINC"&&v.Provider!="FOLDING_AT_HOME"||v.ObservedAt<=0{return SciencePage{},ErrScienceSourceUnavailable}
  // Do not promote untrusted snapshot flags into verified scientific eligibility or chain finality.
  v.Eligibility="UNVERIFIED";v.Finality="UNFINALIZED";v.Authoritative=false;v.RewardEligible=false;v.Amount420=nil
 }
 if len(page.Items)>int(limit){page.Items=page.Items[:limit]}
 return page,nil
}
var _ scienceReader=ScienceSnapshotReader{}
