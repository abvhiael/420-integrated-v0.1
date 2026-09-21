package travelapp

import (
 "strings"

 locationmodel "github.com/420integrated/420-integrated/location/model"
)

// cannabisPlaceLabels describes only the public Location category. Neither a
// dispensary classification nor a farm category proves onsite consumption,
// legal access, operating hours, licensing, or availability.
func cannabisPlaceLabels(category locationmodel.Category) []string {
 switch category {
 case locationmodel.CategoryDispensary:
  return []string{"Listed category: dispensary"}
 case locationmodel.CategoryFarm:
  return []string{"Listed category: farm (public access unverified)"}
 default:
  return nil
 }
}

// cannabisEventLabels recognizes a narrow set of exact public event tags.
// These are descriptive organizer-supplied discovery labels, not verified
// permissions, promises of access, or jurisdictional/legal guidance.
func cannabisEventLabels(tags []string) []string {
 labels := make([]string, 0, 2)
 seen := make(map[string]bool)
 for _, raw := range tags {
  tag := strings.ToLower(strings.TrimSpace(raw))
  var label string
  switch tag {
  case "cannabis", "cannabis-event":
   label = "Tagged: cannabis event"
  case "grow-tour", "grow-attraction":
   label = "Tagged: grow-related attraction (access unverified)"
  }
  if label != "" && !seen[label] {labels = append(labels, label); seen[label] = true}
 }
 return labels
}
