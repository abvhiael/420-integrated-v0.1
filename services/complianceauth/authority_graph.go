package complianceauth

import (
 "errors"
 "sort"
 "strings"
 "time"
)

var ErrAuthorityUncertain = errors.New("jurisdiction authority unresolved")
type BoundaryConfidence string
const (
 BoundaryVerified BoundaryConfidence = "VERIFIED"
 BoundaryBorder BoundaryConfidence = "BORDER"
 BoundaryAmbiguous BoundaryConfidence = "AMBIGUOUS"
 BoundaryUnknown BoundaryConfidence = "UNKNOWN"
)
type AuthorityNode struct {
 ID string
 Kind string // FEDERAL, PROVINCE, MUNICIPALITY, or LOCAL_AUTHORITY
 ParentID string
 LegalJurisdictionID string
 SourceDigest string
 EffectiveFrom time.Time
 EffectiveUntil time.Time
}
type AuthorityGraph struct {
 Version string
 AsOf time.Time
 Nodes []AuthorityNode
}
type AuthorityLocation struct {
 OperatingZoneID string // business routing scope, not a legal jurisdiction
 CandidateJurisdictions []string
 Confidence BoundaryConfidence
 BoundaryEvidenceDigest string
}
type AuthorityResolution struct {
 GraphVersion string
 OperatingZoneID string
 Jurisdictions []string
 State string // RESOLVED or REVIEW_REQUIRED
 PolicyAuthorized bool
}
// ResolveAuthority does not geocode addresses. Candidates and confidence must be
// supplied by an independently trusted boundary resolver. No operating zone can
// impersonate a legal jurisdiction; unknown/border/multiple jurisdictions fail closed.
func ResolveAuthority(g AuthorityGraph,loc AuthorityLocation)(AuthorityResolution,error){
 out:=AuthorityResolution{GraphVersion:g.Version,OperatingZoneID:loc.OperatingZoneID,State:"REVIEW_REQUIRED",PolicyAuthorized:false}
 if strings.TrimSpace(g.Version)==""||g.AsOf.IsZero()||len(g.Nodes)==0||strings.TrimSpace(loc.OperatingZoneID)==""{return out,ErrAuthorityUncertain}
 nodes:=make(map[string]AuthorityNode,len(g.Nodes))
 for _,n:=range g.Nodes{
  if n.ID==""||n.LegalJurisdictionID==""||n.SourceDigest==""||!digestValid(n.SourceDigest)||n.EffectiveFrom.IsZero()||n.EffectiveFrom.After(g.AsOf)||(!n.EffectiveUntil.IsZero()&&!g.AsOf.Before(n.EffectiveUntil))||nodes[n.ID].ID!=""{return out,ErrAuthorityUncertain}
  switch n.Kind{case "FEDERAL","PROVINCE","MUNICIPALITY","LOCAL_AUTHORITY":default:return out,ErrAuthorityUncertain}
  nodes[n.ID]=n
 }
 for _,n:=range g.Nodes{
  visited:=map[string]bool{n.ID:true}
  p:=n.ParentID
  for p!=""{
   parent,exists:=nodes[p]
   if !exists||visited[p]{return out,ErrAuthorityUncertain}
   visited[p]=true;p=parent.ParentID
  }
 }
 if loc.Confidence!=BoundaryVerified||len(loc.CandidateJurisdictions)!=1||!digestValid(loc.BoundaryEvidenceDigest){return out,ErrAuthorityUncertain}
 jurisdiction:=loc.CandidateJurisdictions[0]
 if jurisdiction==""||jurisdiction==loc.OperatingZoneID{return out,ErrAuthorityUncertain}
 matches:=false
 for _,n:=range g.Nodes{if n.LegalJurisdictionID==jurisdiction{matches=true;break}}
 if !matches{return out,ErrAuthorityUncertain}
 // Include the legally applicable ancestor chain; never silently omit higher authority.
 for _,n:=range g.Nodes{
  if n.LegalJurisdictionID!=jurisdiction{continue}
  p:=n.ParentID
  out.Jurisdictions=append(out.Jurisdictions,n.LegalJurisdictionID)
  for p!=""{parent:=nodes[p];out.Jurisdictions=append(out.Jurisdictions,parent.LegalJurisdictionID);p=parent.ParentID}
  break
 }
 sort.Strings(out.Jurisdictions)
 for i:=1;i<len(out.Jurisdictions);i++{if out.Jurisdictions[i]==out.Jurisdictions[i-1]{return AuthorityResolution{State:"REVIEW_REQUIRED",GraphVersion:g.Version,OperatingZoneID:loc.OperatingZoneID},ErrAuthorityUncertain}}
 out.State="RESOLVED" // resolution is not regulatory approval
 return out,nil
}
