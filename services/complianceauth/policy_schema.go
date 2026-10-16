package complianceauth

import (
 "errors"
 "math"
 "strings"
 "time"
)

var ErrInvalidPolicySchema=errors.New("invalid compliance policy schema")
type PolicyActor struct{ Role string; IssuerID string }
type PolicyProduct struct{ Class string; Unit string; EquivalencyNumerator int64; EquivalencyDenominator int64 }
type PolicyStage struct{ Name string; RequiredCredentials []string; RecipientVerification string; PaymentPrerequisite string; ReturnDuty string; RecordObligation string }
type PolicyHours struct{ Timezone string; StartLocal string; EndLocal string; Overnight bool }
type CompliancePolicySchema struct{
 Version string
 PolicyID string
 AuthorityGraphVersion string
 LegalJurisdictionID string
 SourceDigest string
 EffectiveFrom time.Time
 EffectiveUntil time.Time
 Actors []PolicyActor
 Products []PolicyProduct
 Stages []PolicyStage
 Hours PolicyHours
 RequiredRecords []string
 ReviewState string
}
func validNames(xs []string)bool{
 if len(xs)==0||len(xs)>64{return false}
 seen:=map[string]bool{}
 for _,x:=range xs{if x==""||x!=strings.TrimSpace(x)||len(x)>128||seen[x]{return false};seen[x]=true}
 return true
}
func validClock(s string)bool{
 if len(s)!=5||s[2]!=':'{return false}
 for _,i:=range []int{0,1,3,4}{if s[i]<'0'||s[i]>'9'{return false}}
 h:=int(s[0]-'0')*10+int(s[1]-'0');m:=int(s[3]-'0')*10+int(s[4]-'0')
 return h<24&&m<60
}
// ValidatePolicySchema is a structure-only gate, not legal review, publication or permission.
func ValidatePolicySchema(p CompliancePolicySchema)error{
 if p.Version!="420compliance-policy-schema/v1"||p.PolicyID==""||p.AuthorityGraphVersion==""||p.LegalJurisdictionID==""||!digestValid(p.SourceDigest)||p.EffectiveFrom.IsZero()||(!p.EffectiveUntil.IsZero()&&!p.EffectiveFrom.Before(p.EffectiveUntil))||p.ReviewState!="DRAFT_REVIEW_REQUIRED"||
 len(p.Actors)==0||len(p.Products)==0||len(p.Stages)==0||!validNames(p.RequiredRecords)||
 p.Hours.Timezone==""||!validClock(p.Hours.StartLocal)||!validClock(p.Hours.EndLocal)||p.Hours.StartLocal==p.Hours.EndLocal{return ErrInvalidPolicySchema}
 if _,err:=time.LoadLocation(p.Hours.Timezone);err!=nil{return ErrInvalidPolicySchema}
 if p.Hours.StartLocal>p.Hours.EndLocal&&!p.Hours.Overnight{return ErrInvalidPolicySchema}
 actorSeen:=map[string]bool{}
 for _,a:=range p.Actors{if a.Role==""||a.IssuerID==""||actorSeen[a.Role]{return ErrInvalidPolicySchema};actorSeen[a.Role]=true}
 products:=map[string]bool{}
 for _,v:=range p.Products{
  if v.Class==""||v.Unit==""||v.EquivalencyNumerator<=0||v.EquivalencyDenominator<=0||products[v.Class]||v.EquivalencyNumerator>math.MaxInt64/v.EquivalencyDenominator{return ErrInvalidPolicySchema}
  products[v.Class]=true
 }
 stages:=map[string]bool{}
 for _,st:=range p.Stages{
  if st.Name==""||stages[st.Name]||!validNames(st.RequiredCredentials)||
   st.RecipientVerification==""||st.PaymentPrerequisite==""||st.ReturnDuty==""||st.RecordObligation==""{return ErrInvalidPolicySchema}
  stages[st.Name]=true
 }
 return nil
}
