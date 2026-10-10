package complianceauth
import("errors";"testing";"time")
func TestC031AuthorityGraphBoundaries(t *testing.T){
 at:=time.Date(2026,10,10,20,0,0,0,time.UTC)
 makeNode:=func(id,kind,parent,legal string)AuthorityNode{return AuthorityNode{ID:id,Kind:kind,ParentID:parent,LegalJurisdictionID:legal,SourceDigest:Digest([]byte(id)),EffectiveFrom:at.Add(-time.Hour)}}
 g:=AuthorityGraph{Version:"fixture-version-1",AsOf:at,Nodes:[]AuthorityNode{makeNode("fed","FEDERAL","","CA"),makeNode("province","PROVINCE","fed","CA-BC"),makeNode("city","MUNICIPALITY","province","CA-BC-VAN")}}
 input:=AuthorityLocation{OperatingZoneID:"DOOBr-DELIVERY-AREA",CandidateJurisdictions:[]string{"CA-BC-VAN"},Confidence:BoundaryVerified,BoundaryEvidenceDigest:Digest([]byte("independently verified boundary"))}
 out,err:=ResolveAuthority(g,input)
 if err!=nil||out.State!="RESOLVED"||out.PolicyAuthorized||len(out.Jurisdictions)!=3||out.Jurisdictions[0]!="CA"||out.Jurisdictions[2]!="CA-BC-VAN"{t.Fatalf("valid graph: %+v %v",out,err)}
 cases:=[]struct{name string;mutate func(*AuthorityGraph,*AuthorityLocation)}{
 {"border",func(_ *AuthorityGraph,l *AuthorityLocation){l.Confidence=BoundaryBorder}},
 {"unknown",func(_ *AuthorityGraph,l *AuthorityLocation){l.Confidence=BoundaryUnknown}},
 {"ambiguous",func(_ *AuthorityGraph,l *AuthorityLocation){l.Confidence=BoundaryAmbiguous}},
 {"multi jurisdiction",func(_ *AuthorityGraph,l *AuthorityLocation){l.CandidateJurisdictions=[]string{"CA-BC-VAN","CA-BC"}}},
 {"not in graph",func(_ *AuthorityGraph,l *AuthorityLocation){l.CandidateJurisdictions=[]string{"CA-ON"}}},
 {"zone mistaken for law",func(_ *AuthorityGraph,l *AuthorityLocation){l.OperatingZoneID="CA-BC-VAN"}},
 {"unverified boundary",func(_ *AuthorityGraph,l *AuthorityLocation){l.BoundaryEvidenceDigest=""}},
 {"expired node",func(g *AuthorityGraph,_ *AuthorityLocation){g.Nodes[2].EffectiveUntil=at}},
 {"missing parent",func(g *AuthorityGraph,_ *AuthorityLocation){g.Nodes[2].ParentID="unknown"}},
 {"parent cycle",func(g *AuthorityGraph,_ *AuthorityLocation){g.Nodes[0].ParentID="city"}},
 {"duplicate node",func(g *AuthorityGraph,_ *AuthorityLocation){g.Nodes=append(g.Nodes,g.Nodes[1])}},
 {"invalid version",func(g *AuthorityGraph,_ *AuthorityLocation){g.Version=""}},
 }
 for _,tc:=range cases{t.Run(tc.name,func(t *testing.T){copyGraph:=g;copyGraph.Nodes=append([]AuthorityNode(nil),g.Nodes...);copyInput:=input;tc.mutate(&copyGraph,&copyInput);got,e:=ResolveAuthority(copyGraph,copyInput);if !errors.Is(e,ErrAuthorityUncertain)||got.PolicyAuthorized||got.State!="REVIEW_REQUIRED"{t.Fatalf("unresolved authority accepted: %+v %v",got,e)}})}
}
