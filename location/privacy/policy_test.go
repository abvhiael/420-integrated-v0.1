package privacy

import (
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/location/model"
)

func place(id string, visibility model.Visibility, precision model.PlacePrecision) model.Place {
	now:=time.Date(2026,9,19,2,0,0,0,time.UTC)
	lat,lon:=50.4452,-104.6189
	return model.Place{
		ID:id,Name:"Sensitive Place",Category:model.CategoryOther,
		Visibility:visibility,Precision:precision,Source:"test",
		Owner:model.SubjectRef{Type:"PROFILE",ID:"user-1"},
		Address:"123 Secret Street",Country:"CA",Region:"SK",City:"Regina",PostalRegion:"S4P",
		Latitude:&lat,Longitude:&lon,
		Version:1,CreatedAt:now,UpdatedAt:now,
	}
}

func TestExactPublicProjectionKeepsCoordinates(t *testing.T){
	p:=place("public",model.VisibilityPublic,model.PrecisionExactPublic)
	got,err:=New().PublicProjection(p)
	if err!=nil { t.Fatal(err) }
	if got.Latitude==nil || got.Longitude==nil { t.Fatal("exact public coordinates removed") }
}

func TestApproximatePublicProjectionRedactsExactCoordinatesAndAddress(t *testing.T){
	p:=place("approx",model.VisibilityPublic,model.PrecisionApproximate)
	got,err:=New().PublicProjection(p)
	if err!=nil { t.Fatal(err) }
	if got.Latitude!=nil || got.Longitude!=nil { t.Fatal("approximate place leaked exact coordinates") }
	serialized:=fmt.Sprintf("%+v",got)
	if strings.Contains(serialized,"123 Secret Street") { t.Fatal("approximate place leaked street address") }
	if got.City!="Regina" || got.Region!="SK" { t.Fatalf("coarse region lost: %+v",got) }
}

func TestPrivateAndUnlistedPlacesHaveNoPublicProjection(t *testing.T){
	for _,p:=range []model.Place{
		place("private",model.VisibilityPrivate,model.PrecisionPrivate),
		place("unlisted",model.VisibilityUnlisted,model.PrecisionApproximate),
	} {
		if _,err:=New().PublicProjection(p); !errors.Is(err,ErrNotPublic) {
			t.Fatalf("%s err=%v",p.ID,err)
		}
	}
}

func TestApproximateAndPrivateCannotUseExactCoordinateOperations(t *testing.T){
	policy:=New()
	if policy.CanReverseGeocode(place("approx",model.VisibilityPublic,model.PrecisionApproximate)) { t.Fatal("approx reverse geocode permitted") }
	if policy.CanPublicProximitySearch(place("approx",model.VisibilityPublic,model.PrecisionApproximate)) { t.Fatal("approx proximity permitted") }
	if policy.CanReverseGeocode(place("private",model.VisibilityPrivate,model.PrecisionPrivate)) { t.Fatal("private reverse geocode permitted") }
}

func TestRedactErrorPreventsCoordinateLeak(t *testing.T){
	p:=place("private",model.VisibilityPrivate,model.PrecisionPrivate)
	err:=New().RedactError(errors.New("latitude 50.4452 longitude -104.6189 invalid"),&p)
	if !errors.Is(err,ErrPrivateOperation) { t.Fatalf("err=%v",err) }
	if strings.Contains(err.Error(),"50.4452") || strings.Contains(err.Error(),"-104.6189") { t.Fatal("coordinate leaked through error") }
}

func TestPublicExactErrorsMayPassThrough(t *testing.T){
	p:=place("public",model.VisibilityPublic,model.PrecisionExactPublic)
	original:=errors.New("coordinate is invalid")
	if got:=New().RedactError(original,&p); got!=original { t.Fatalf("error unexpectedly redacted: %v",got) }
}
