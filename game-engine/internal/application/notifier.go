package application

type GatewayNotifier interface {
	NotifyEvent(eventName string, payload interface{})
}