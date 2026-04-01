package application

type GatewayNotifier interface {
	// NotifyEvent invia un evento in modo asincrono.
	// eventName: es. "PlayerVoted", "GameStarted"
	NotifyEvent(eventName string, payload interface{})
}