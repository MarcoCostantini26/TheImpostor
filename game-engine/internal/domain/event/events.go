package event

import "time"

// DomainEvent è l'interfaccia che tutti gli eventi del nostro gioco dovranno rispettare
type DomainEvent interface {
	EventName() string
	OccurredOn() time.Time
}

// BaseEvent è una struct "di supporto" che contiene i dati comuni a tutti gli eventi
type BaseEvent struct {
	OccurredAt time.Time
}

// Implementiamo il metodo OccurredOn per BaseEvent, così tutte le struct che lo includono lo erediteranno
func (b BaseEvent) OccurredOn() time.Time {
	return b.OccurredAt
}

// ==========================================
// GLI EVENTI SPECIFICI DEL GIOCO
// ==========================================

// GameStarted viene emesso quando la partita inizia e i ruoli sono stati assegnati
type GameStarted struct {
	BaseEvent
	GameID string
}

func (e GameStarted) EventName() string { return "GameStarted" }

// TurnExpired viene emesso quando il timer del turno corrente scade (es. fine discussione)
type TurnExpired struct {
	BaseEvent
	GameID      string
	RoundNumber int
}

func (e TurnExpired) EventName() string { return "TurnExpired" }

// GameEnded viene emesso quando il GameRulesService decreta un vincitore
type GameEnded struct {
	BaseEvent
	GameID      string
	WinningTeam string // es. "CREWMATES_WIN" o "IMPOSTOR_WINS"
}

func (e GameEnded) EventName() string { return "GameEnded" }