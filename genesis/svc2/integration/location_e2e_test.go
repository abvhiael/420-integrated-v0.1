package integration

import (
 "context"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "os"
 "path/filepath"
 "strings"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/genesis/svc2/httpapi"
 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
 "github.com/420integrated/420-integrated/location/model"
 "github.com/420integrated/420-integrated/location/repository"
)

// TestLocationRepositoryToSDK exercises persisted canonical data through the
// read-only public HTTP projection and the typed SDK, not a mock place source.
func TestLocationRepositoryToSDK(t *testing.T) {
 ctx:=context.Background()
 path:=filepath.Join(t.TempDir(),"places.json")
 store,err:=repository.OpenFileStore(path);if err!=nil{t.Fatal(err)}
 if err:=store.Ready(ctx);err!=nil{t.Fatal(err)}
 now:=time.Date(2026,9,19,12,0,0,0,time.UTC)
 lat,lon:=50.4452,-104.6189
 fixture:=func(id string) model.Place {return model.Place{
  ID:id,Name:id,Category:model.CategoryVenue,Visibility:model.VisibilityPublic,
  Precision:model.PrecisionExactPublic,Source:"420Location",Owner:model.SubjectRef{Type:"ORGANIZATION",ID:"org-1"},
  Country:"CA",Region:"SK",City:"Regina",Latitude:&lat,Longitude:&lon,
  Address:"PRIVATE ADDRESS NOT IN PUBLIC VIEW",PostalRegion:"PRIVATE POSTAL",ProviderAliases:[]model.ProviderAlias{{Provider:"osm",ID:id}},
  Version:1,CreatedAt:now,UpdatedAt:now,
 }}
 exact:=fixture("public-exact")
 approximate:=fixture("public-approximate");approximate.Precision=model.PrecisionApproximate
 private:=fixture("private-place");private.Visibility=model.VisibilityPrivate;private.Precision=model.PrecisionPrivate
 unlisted:=fixture("unlisted-place");unlisted.Visibility=model.VisibilityUnlisted;unlisted.Precision=model.PrecisionPrivate
 for _,p:=range []model.Place{exact,approximate,private,unlisted}{if _,err:=store.Create(p);err!=nil{t.Fatalf("create %s: %v",p.ID,err)}}
 reopened,err:=repository.OpenFileStore(path);if err!=nil{t.Fatal(err)}
 if reopened.Count()!=4{t.Fatalf("persisted place count = %d",reopened.Count())}
 server:=httptest.NewServer(httpapi.Server{Places:reopened}.Handler());defer server.Close()
 client:=sdk.Client{BaseURL:server.URL,HTTP:server.Client()}
 check:=func(wantExact bool){t.Helper()
  view,err:=client.Places(ctx);if err!=nil{t.Fatal(err)}
  if view.Empty||len(view.Items)!=2{t.Fatalf("unexpected public view: %+v",view)}
  byID:=map[string]bool{}
  for _,item:=range view.Items{
   byID[item.ID]=true
   switch item.ID{
   case "public-exact":
    if wantExact && (item.Kind!="pin"||item.Latitude==nil||item.Longitude==nil||*item.Latitude!=lat||*item.Longitude!=lon){t.Fatalf("public pin mismatch: %+v",item)}
    if !wantExact && (item.Kind!="area"||item.Latitude!=nil||item.Longitude!=nil){t.Fatalf("updated precision leaked coordinates: %+v",item)}
   case "public-approximate":if item.Kind!="area"||item.Latitude!=nil||item.Longitude!=nil{t.Fatalf("approximate coordinates leaked: %+v",item)}
   default:t.Fatalf("nonpublic place exposed: %+v",item)
   }
  }
  if !byID["public-exact"]||!byID["public-approximate"]{t.Fatalf("public places missing: %+v",view)}
  response,err:=server.Client().Get(server.URL+"/v1/places");if err!=nil{t.Fatal(err)}
  defer response.Body.Close()
  var payload map[string]any
  if err:=json.NewDecoder(response.Body).Decode(&payload);err!=nil{t.Fatal(err)}
  if payload["version"]!="v1"{t.Fatalf("unexpected API envelope: %+v",payload)}
  raw,err:=json.Marshal(payload);if err!=nil{t.Fatal(err)}
  for _,secret:=range []string{"private-place","unlisted-place","PRIVATE ADDRESS","PRIVATE POSTAL","providerAliases","node/","osm"}{
   if strings.Contains(string(raw),secret){t.Fatalf("private repository field %q exposed in public response",secret)}
  }
 }
 check(true)
 next,err:=reopened.Get("public-exact");if err!=nil{t.Fatal(err)}
 next.Precision=model.PrecisionApproximate;next.Version++;next.UpdatedAt=next.UpdatedAt.Add(time.Minute)
 if _,err:=reopened.Update(next,1);err!=nil{t.Fatal(err)}
 check(false)
 // Restart after update: persisted privacy state must survive reopening.
 again,err:=repository.OpenFileStore(path);if err!=nil{t.Fatal(err)}
 persisted,err:=again.Get("public-exact");if err!=nil||persisted.Precision!=model.PrecisionApproximate{t.Fatalf("precision not persisted: %+v %v",persisted,err)}
 if info,err:=os.Stat(path);err!=nil||info.Mode().Perm()!=0o600{t.Fatalf("repository file permissions: %v %v",info,err)}
 mutation,err:=server.Client().Post(server.URL+"/v1/places","application/json",strings.NewReader(`{}`));if err!=nil{t.Fatal(err)}
 defer mutation.Body.Close();if mutation.StatusCode!=http.StatusMethodNotAllowed{t.Fatalf("write route status = %d",mutation.StatusCode)}
}
