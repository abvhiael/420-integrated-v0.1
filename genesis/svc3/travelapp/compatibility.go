package travelapp

import (
 "context"
 "errors"
 "strings"
 "time"
)

// The v1 compatibility types are future integration contracts, not live listings,
// price quotes, inventory, authorization, or commitments to provide a service.
// Travel cannot derive booking or delivery authority from these records.
const TravelCompatibilityVersion = "travel-compat/v1"

var ErrTravelTransactionDisabled = errors.New("travel reservations, payments and delivery transactions are disabled at genesis")
var ErrTravelContractInvalid = errors.New("invalid travel compatibility contract")

// Property and Host refer to an existing public Location place and an external
// identity/registry authority. They do not create either record.
type Property struct {
 SchemaVersion string `json:"schemaVersion"`
 ID string `json:"id"`
 PlaceID string `json:"placeId"`
 HostID string `json:"hostId"`
}
type Host struct {
 SchemaVersion string `json:"schemaVersion"`
 ID string `json:"id"`
 IdentityRef string `json:"identityRef"`
 RegistryRecordID string `json:"registryRecordId,omitempty"`
}
type Guest struct {
 SchemaVersion string `json:"schemaVersion"`
 ID string `json:"id"`
 IdentityRef string `json:"identityRef"`
}
// Availability represents a potential future query interval, not guaranteed
// inventory. No public Travel reader currently publishes availability.
type Availability struct {
 SchemaVersion string `json:"schemaVersion"`
 PropertyID string `json:"propertyId"`
 From time.Time `json:"from"`
 To time.Time `json:"to"`
}
// NightlyPrice is an untrusted, non-binding schema placeholder. AmountMinor
// avoids floating-point money, while currency/provider must be verified by an
// external pricing authority before any future user-facing quote is shown.
type NightlyPrice struct {
 SchemaVersion string `json:"schemaVersion"`
 PropertyID string `json:"propertyId"`
 Currency string `json:"currency"`
 AmountMinor uint64 `json:"amountMinor"`
 ProviderRef string `json:"providerRef"`
}
type Reservation struct {
 SchemaVersion string `json:"schemaVersion"`
 ID string `json:"id"`
 PropertyID string `json:"propertyId"`
 GuestID string `json:"guestId"`
 From time.Time `json:"from"`
 To time.Time `json:"to"`
}

type ServiceProvider struct {
 SchemaVersion string `json:"schemaVersion"`
 ID string `json:"id"`
 PlaceID string `json:"placeId"`
 IdentityRef string `json:"identityRef"`
}
// ServiceArea is coarse textual geography, not a private address or exact pin.
type ServiceArea struct {
 SchemaVersion string `json:"schemaVersion"`
 ProviderID string `json:"providerId"`
 Region string `json:"region"`
 Country string `json:"country"`
}
type DeliveryWindow struct {
 SchemaVersion string `json:"schemaVersion"`
 ProviderID string `json:"providerId"`
 From time.Time `json:"from"`
 To time.Time `json:"to"`
}
type ServiceRequest struct {
 SchemaVersion string `json:"schemaVersion"`
 ID string `json:"id"`
 ProviderID string `json:"providerId"`
 RequesterIdentityRef string `json:"requesterIdentityRef"`
 Window DeliveryWindow `json:"window"`
}

func compatibleID(id string) bool { return validPlaceID(id) }
func compatibleRef(ref string) bool {
 if len(ref)==0 || len(ref)>256 || strings.TrimSpace(ref)!=ref {return false}
 for _,r:=range ref {if r<=32 || r==127 {return false}}
 return true
}
func validWindow(from,to time.Time) bool {return !from.IsZero() && !to.IsZero() && to.After(from) && to.Sub(from)<=366*24*time.Hour}
func versionOK(version string) bool {return version==TravelCompatibilityVersion}

func (p Property) Validate() error {if !versionOK(p.SchemaVersion)||!compatibleID(p.ID)||!compatibleID(p.PlaceID)||!compatibleID(p.HostID){return ErrTravelContractInvalid};return nil}
func (h Host) Validate() error {if !versionOK(h.SchemaVersion)||!compatibleID(h.ID)||!compatibleRef(h.IdentityRef)||(h.RegistryRecordID!=""&&!compatibleRef(h.RegistryRecordID)){return ErrTravelContractInvalid};return nil}
func (g Guest) Validate() error {if !versionOK(g.SchemaVersion)||!compatibleID(g.ID)||!compatibleRef(g.IdentityRef){return ErrTravelContractInvalid};return nil}
func (a Availability) Validate() error {if !versionOK(a.SchemaVersion)||!compatibleID(a.PropertyID)||!validWindow(a.From,a.To){return ErrTravelContractInvalid};return nil}
func (p NightlyPrice) Validate() error {if !versionOK(p.SchemaVersion)||!compatibleID(p.PropertyID)||len(p.Currency)!=3||!compatibleRef(p.ProviderRef){return ErrTravelContractInvalid};for _,c:=range p.Currency {if c<'A'||c>'Z' {return ErrTravelContractInvalid}};return nil}
func (r Reservation) Validate() error {if !versionOK(r.SchemaVersion)||!compatibleID(r.ID)||!compatibleID(r.PropertyID)||!compatibleID(r.GuestID)||!validWindow(r.From,r.To){return ErrTravelContractInvalid};return nil}
func (p ServiceProvider) Validate() error {if !versionOK(p.SchemaVersion)||!compatibleID(p.ID)||!compatibleID(p.PlaceID)||!compatibleRef(p.IdentityRef){return ErrTravelContractInvalid};return nil}
func (a ServiceArea) Validate() error {if !versionOK(a.SchemaVersion)||!compatibleID(a.ProviderID)||len(a.Region)>80||len(a.Country)>80||strings.TrimSpace(a.Region)==""||strings.TrimSpace(a.Country)==""||strings.ContainsAny(a.Region+a.Country,"\x00\r\n"){return ErrTravelContractInvalid};return nil}
func (w DeliveryWindow) Validate() error {if !versionOK(w.SchemaVersion)||!compatibleID(w.ProviderID)||!validWindow(w.From,w.To){return ErrTravelContractInvalid};return nil}
func (r ServiceRequest) Validate() error {if !versionOK(r.SchemaVersion)||!compatibleID(r.ID)||!compatibleID(r.ProviderID)||!compatibleRef(r.RequesterIdentityRef)||r.Window.ProviderID!=r.ProviderID||r.Window.Validate()!=nil{return ErrTravelContractInvalid};return nil}

// GenesisTravelTransactions does not hold external booking, delivery, escrow or
// payment dependencies. Its methods MUST remain fail-closed regardless of input.
// A future implementation requires a new, explicitly reviewed interface and
// authenticated, regulated transaction service; these methods are not switches.
type GenesisTravelTransactions struct{}
func (GenesisTravelTransactions) Reserve(_ context.Context,_ Reservation) error {return ErrTravelTransactionDisabled}
func (GenesisTravelTransactions) Quote(_ context.Context,_ NightlyPrice) error {return ErrTravelTransactionDisabled}
func (GenesisTravelTransactions) Pay(_ context.Context,_ string) error {return ErrTravelTransactionDisabled}
func (GenesisTravelTransactions) Escrow(_ context.Context,_ string) error {return ErrTravelTransactionDisabled}
func (GenesisTravelTransactions) CancelAndSettle(_ context.Context,_ string) error {return ErrTravelTransactionDisabled}
func (GenesisTravelTransactions) RequestDelivery(_ context.Context,_ ServiceRequest) error {return ErrTravelTransactionDisabled}
func (GenesisTravelTransactions) DynamicPrice(_ context.Context,_ string) error {return ErrTravelTransactionDisabled}
