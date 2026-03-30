package http

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

// HTTPGatewayNotifier implementa l'interfaccia GatewayNotifier usando richieste HTTP POST
type HTTPGatewayNotifier struct {
	WebhookURL string
}

// NewHTTPGatewayNotifier crea un nuovo notifier con l'URL di destinazione
func NewHTTPGatewayNotifier(url string) *HTTPGatewayNotifier {
	return &HTTPGatewayNotifier{
		WebhookURL: url,
	}
}

// Struttura fissa che il Node.js si aspetterà di ricevere
type WebhookMessage struct {
	Event   string      `json:"event"`
	Payload interface{} `json:"payload"`
}

func (n *HTTPGatewayNotifier) NotifyEvent(eventName string, payload interface{}) {
	go func() {
		msg := WebhookMessage{
			Event:   eventName,
			Payload: payload,
		}

		jsonBody, err := json.Marshal(msg)
		if err != nil {
			fmt.Printf("⚠️ Errore Webhook: impossibile convertire in JSON: %v\n", err)
			return
		}

		resp, err := http.Post(n.WebhookURL, "application/json", bytes.NewBuffer(jsonBody))
		if err != nil {
			fmt.Printf("⚠️ Errore Webhook: impossibile contattare Node.js a %s: %v\n", n.WebhookURL, err)
			return
		}
		defer resp.Body.Close()

		fmt.Printf("📞 Notifica Webhook inviata a Node.js: [%s]\n", eventName)
	}()
}