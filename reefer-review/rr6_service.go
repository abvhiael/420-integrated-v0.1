package reeferreview

type EcosystemIntegrationBundle struct {
	Search        Search
	Notifications Notifications
	Mail          Mail
	Reconciler    IntegrationReconciler
	Outbox        *IntegrationOutbox
}

func NewEcosystemIntegrationBundle(outboxPath string, search Search, notifications Notifications, mail Mail) (EcosystemIntegrationBundle, error) {
	if search == nil || notifications == nil || mail == nil {
		return EcosystemIntegrationBundle{}, ErrIntegrationConfiguration
	}
	outbox, err := OpenIntegrationOutbox(outboxPath)
	if err != nil {
		return EcosystemIntegrationBundle{}, err
	}
	return EcosystemIntegrationBundle{
		Search:        QueuedSearch{Outbox: outbox, Delegate: search},
		Notifications: QueuedNotifications{Outbox: outbox, Delegate: notifications},
		Mail:          QueuedMail{Outbox: outbox, Delegate: mail},
		Reconciler: IntegrationReconciler{
			Outbox: outbox, Search: search, Notifications: notifications, Mail: mail,
		},
		Outbox: outbox,
	}, nil
}
