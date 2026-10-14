package complianceauth

import (
 "errors"
 "sort"
 "time"
)
var ErrTemporalUncertain=errors.New("compliance temporal applicability unresolved")

// TemporalVersion is immutable evidence for what was known at a particular time.
// RecordedAt is knowledge time; effective bounds are legal validity time.
type TemporalVersion struct {
 EvidenceID string
 SourceDigest string
 RecordedAt time.Time
 EffectiveFrom time.Time
 EffectiveUntil time.Time
 RepealedAt time.Time
}
type TemporalRequest struct{
 At time.Time
 KnowledgeAt time.Time
 Timezone string
 StartLocal string
 EndLocal string
 Overnight bool
 Versions []TemporalVersion
}
type TemporalDecision struct{
 State string
 EvidenceID string
 LocalTime string
 PolicyAuthorized bool
}
func clockMinutes(s string)(int,error){
 if !validClock(s){return 0,ErrTemporalUncertain}
 return int(s[0]-'0')*600+int(s[1]-'0')*60+int(s[3]-'0')*10+int(s[4]-'0'),nil
}
// EvaluateTemporalApplicability reports temporal eligibility, not legal permission.
// Ambiguous/missing version history and invalid time windows remain review-required.
func EvaluateTemporalApplicability(q TemporalRequest)(TemporalDecision,error){
 out:=TemporalDecision{State:"REVIEW_REQUIRED"}
 if q.At.IsZero()||q.KnowledgeAt.IsZero()||q.Timezone==""||len(q.Versions)==0{return out,ErrTemporalUncertain}
 loc,err:=time.LoadLocation(q.Timezone);if err!=nil{return out,ErrTemporalUncertain}
 start,err:=clockMinutes(q.StartLocal);if err!=nil{return out,err}
 end,err:=clockMinutes(q.EndLocal);if err!=nil||start==end||(start>end&&!q.Overnight)||(start<end&&q.Overnight){return out,ErrTemporalUncertain}
 versions:=append([]TemporalVersion(nil),q.Versions...)
 sort.Slice(versions,func(i,j int)bool{return versions[i].RecordedAt.Before(versions[j].RecordedAt)})
 var chosen *TemporalVersion
 for i:=range versions{
  v:=&versions[i]
  if v.EvidenceID==""||!digestValid(v.SourceDigest)||v.RecordedAt.IsZero()||v.EffectiveFrom.IsZero()||
    (!v.EffectiveUntil.IsZero()&&!v.EffectiveFrom.Before(v.EffectiveUntil))||
    (!v.RepealedAt.IsZero()&&v.RepealedAt.Before(v.EffectiveFrom))||
    (i>0&&!versions[i-1].RecordedAt.Before(v.RecordedAt)){return out,ErrTemporalUncertain}
  if !v.RecordedAt.After(q.KnowledgeAt){chosen=v}
 }
 if chosen==nil{return out,ErrTemporalUncertain}
 out.EvidenceID=chosen.EvidenceID
 local:=q.At.In(loc);out.LocalTime=local.Format(time.RFC3339)
 if q.At.Before(chosen.EffectiveFrom)||(!chosen.EffectiveUntil.IsZero()&&!q.At.Before(chosen.EffectiveUntil))||(!chosen.RepealedAt.IsZero()&&!q.At.Before(chosen.RepealedAt)){
  out.State="NOT_OPERATIVE";return out,nil
 }
 minute:=local.Hour()*60+local.Minute()
 open:=minute>=start&&minute<end
 if q.Overnight{open=minute>=start||minute<end}
 if !open {out.State="OUTSIDE_LOCAL_HOURS";return out,nil}
 out.State="TEMPORALLY_APPLICABLE_REVIEW_REQUIRED"
 return out,nil
}
