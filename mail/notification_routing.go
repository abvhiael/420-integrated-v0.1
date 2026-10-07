package mail

import (
	"context"
	"fmt"
	"strings"
)

const (
	NotificationRoute420Notifications = "420notifications"
	NotificationRouteSignal           = "signal"
)

type notificationRoute interface {
	ID() string
	NotifyMail(context.Context, Notification) error
}

type notificationSinkRoute struct {
	id   string
	sink NotificationSink
}

func (r notificationSinkRoute) ID() string { return r.id }

func (r notificationSinkRoute) NotifyMail(ctx context.Context, n Notification) error {
	return r.sink.NotifyMail(ctx, n)
}

type signalNotificationRoute struct {
	service *SignalNotificationService
}

func (r signalNotificationRoute) ID() string { return NotificationRouteSignal }

func (r signalNotificationRoute) NotifyMail(ctx context.Context, n Notification) error {
	_, err := r.service.Notify(ctx, n)
	return err
}

type NotificationRouteFailure struct {
	Route string
	Err   error
}

type NotificationRoutingError struct {
	Failures []NotificationRouteFailure
}

func (e *NotificationRoutingError) Error() string {
	if e == nil || len(e.Failures) == 0 {
		return "mail: notification routing failed"
	}
	parts := make([]string, 0, len(e.Failures))
	for _, failure := range e.Failures {
		parts = append(parts, failure.Route+": "+failure.Err.Error())
	}
	return "mail: notification routing failed: " + strings.Join(parts, "; ")
}

func (e *NotificationRoutingError) Unwrap() []error {
	if e == nil {
		return nil
	}
	out := make([]error, 0, len(e.Failures))
	for _, failure := range e.Failures {
		if failure.Err != nil {
			out = append(out, failure.Err)
		}
	}
	return out
}

type UnifiedNotificationRouter struct {
	routes []notificationRoute
}

func NewUnifiedNotificationRouter(primary NotificationSink, signal *SignalNotificationService) *UnifiedNotificationRouter {
	routes := make([]notificationRoute, 0, 2)
	if primary != nil {
		routes = append(routes, notificationSinkRoute{id: NotificationRoute420Notifications, sink: primary})
	}
	if signal != nil {
		routes = append(routes, signalNotificationRoute{service: signal})
	}
	return &UnifiedNotificationRouter{routes: routes}
}

func (r *UnifiedNotificationRouter) Routes() []string {
	if r == nil {
		return nil
	}
	out := make([]string, 0, len(r.routes))
	for _, route := range r.routes {
		out = append(out, route.ID())
	}
	return out
}

func (r *UnifiedNotificationRouter) NotifyMail(ctx context.Context, n Notification) error {
	n.MessageID = strings.TrimSpace(n.MessageID)
	n.Recipient = strings.TrimSpace(n.Recipient)
	if n.MessageID == "" || n.Recipient == "" {
		return ErrInvalidInput
	}
	if r == nil || len(r.routes) == 0 {
		return nil
	}

	failures := make([]NotificationRouteFailure, 0)
	seen := map[string]bool{}
	for _, route := range r.routes {
		if route == nil {
			continue
		}
		id := strings.TrimSpace(route.ID())
		if id == "" || seen[id] {
			failures = append(failures, NotificationRouteFailure{Route: id, Err: fmt.Errorf("invalid notification route")})
			continue
		}
		seen[id] = true
		if err := route.NotifyMail(ctx, n); err != nil {
			failures = append(failures, NotificationRouteFailure{Route: id, Err: err})
		}
	}
	if len(failures) != 0 {
		return &NotificationRoutingError{Failures: failures}
	}
	return nil
}
