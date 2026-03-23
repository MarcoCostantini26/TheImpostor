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

// PhaseChanged viene emesso quando si passa da Discussione a Votazione
type PhaseChanged struct {
	BaseEvent
	GameID   string
	NewPhase string // es. "VOTING"
	Timer    int    // I secondi a disposizione per questa nuova fase
}

func (e PhaseChanged) EventName() string { return "PhaseChanged" }

// PlayerVoted viene emesso quando qualcuno esprime un voto in segreto.
// (Il Frontend userà questo evento per mostrare la spunta "ha votato" vicino al nome del giocatore)
type PlayerVoted struct {
	BaseEvent
	GameID  string
	VoterID string
}

func (e PlayerVoted) EventName() string { return "PlayerVoted" }

// PlayerEliminated viene emesso quando un giocatore viene esiliato dopo le votazioni
// o (in futuro) ucciso dall'impostore.
type PlayerEliminated struct {
	BaseEvent
	GameID   string
	PlayerID string
}

func (e PlayerEliminated) EventName() string { return "PlayerEliminated" }