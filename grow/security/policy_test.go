package security

import "testing"

func TestRoleMatrixAndDenyByDefault(t *testing.T) {
	allow := map[Role][]Action{
		Owner:{View,PlantWrite,FacilityManage,InventoryAdjust,AuditExport,MembersManage,EquipmentObserve},
		Manager:{View,PlantWrite,FacilityManage,InventoryAdjust,AuditExport,EquipmentObserve},
		Technician:{View,PlantWrite,EquipmentObserve},
		Reviewer:{View,AuditExport},
		Maintainer:{EquipmentObserve},
	}
	actions:=[]Action{View,PlantWrite,FacilityManage,InventoryAdjust,AuditExport,MembersManage,EquipmentObserve,DeviceControl,"INVALID",""}
	for _, role:=range []Role{Owner,Manager,Technician,Reviewer,Maintainer,"PUBLIC",""} {
		for _, action:=range actions {
			expected:=false
			for _, a:=range allow[role] { if a==action { expected=true } }
			got:=Authorize(Principal{SubjectID:"s",Authenticated:true},Grant{SubjectID:"s",TenantID:"t",Role:role,State:Active},Resource{TenantID:"t"},action)
			if got!=expected {t.Fatalf("role %q action %q got %v expected %v",role,action,got,expected)}
		}
	}
}
func TestCrossTenantSubjectAndMembershipDeny(t *testing.T){
	p:=Principal{SubjectID:"user",Authenticated:true}
	g:=Grant{SubjectID:"user",TenantID:"alpha",Role:Owner,State:Active}
	r:=Resource{TenantID:"alpha"}
	if !Authorize(p,g,r,View){t.Fatal("valid membership rejected")}
	for _,bad:=range []struct{name string;p Principal;g Grant;r Resource}{
		{"anonymous",Principal{},g,r},
		{"claimed identity",Principal{SubjectID:"user"},g,r},
		{"wrong subject",Principal{SubjectID:"intruder",Authenticated:true},g,r},
		{"wrong membership",p,Grant{SubjectID:"other",TenantID:"alpha",Role:Owner,State:Active},r},
		{"cross tenant",p,g,Resource{TenantID:"beta"}},
		{"empty resource",p,g,Resource{}},
		{"empty grant tenant",p,Grant{SubjectID:"user",Role:Owner,State:Active},r},
		{"suspended",p,Grant{SubjectID:"user",TenantID:"alpha",Role:Owner,State:Suspended},r},
		{"revoked",p,Grant{SubjectID:"user",TenantID:"alpha",Role:Owner,State:Revoked},r},
		{"unknown state",p,Grant{SubjectID:"user",TenantID:"alpha",Role:Owner,State:""},r},
	} {
		if Authorize(bad.p,bad.g,bad.r,View){t.Fatalf("authorized %s",bad.name)}
	}
}
func TestFacilityZoneScopesNeverWiden(t *testing.T) {
	p:=Principal{SubjectID:"u",Authenticated:true}
	g:=Grant{SubjectID:"u",TenantID:"t",FacilityID:"f",ZoneID:"z",Role:Technician,State:Active}
	for _,r:=range []Resource{
		{TenantID:"t",FacilityID:"other",ZoneID:"z"},
		{TenantID:"t",FacilityID:"f",ZoneID:"other"},
		{TenantID:"t",FacilityID:"f"},
		{TenantID:"t"},
	} {if Authorize(p,g,r,View) {t.Fatalf("scope widened: %+v",r)}}
	if !Authorize(p,g,Resource{TenantID:"t",FacilityID:"f",ZoneID:"z"},PlantWrite) {t.Fatal("valid zone action denied")}
	g.FacilityID=""
	if Authorize(p,g,Resource{TenantID:"t",ZoneID:"z"},View){t.Fatal("orphan zone grant accepted")}
}
func TestDeviceControlIsNeverRoleGranted(t *testing.T){
	for _,role:=range []Role{Owner,Manager,Technician,Reviewer,Maintainer}{
		if Authorize(Principal{SubjectID:"u",Authenticated:true},Grant{SubjectID:"u",TenantID:"t",State:Active,Role:role},Resource{TenantID:"t"},DeviceControl){
			t.Fatalf("role %s controls device without independent safety authority",role)
		}
	}
}
