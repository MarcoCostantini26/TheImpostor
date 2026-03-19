package aggregate

import (
	"game-engine/internal/domain/entity"
	"game-engine/internal/domain/event"
	"game-engine/internal/domain/valueobject"
)

const (
	StateWaiting = "WAITING"
	StatePlaying = "PLAYING"
	StateEnded   = "ENDED"
)

type Game struct {
	ID          string
	State       string
	Players     []entity.Player
	CurrentTurn valueobject.Turn
	Word        valueobject.Word
	Hint        valueobject.Hint
	Votes       []valueobject.Vote
	domainEvents []event.DomainEvent 
}

// ==========================================
// METODI PER LA GESTIONE DEGLI EVENTI
// ==========================================

// RecordEvent aggiunge un nuovo evento alla coda del gioco
func (g *Game) RecordEvent(e event.DomainEvent) {
	g.domainEvents = append(g.domainEvents, e)
}

// GetEvents restituisce tutti gli eventi accumulati (per poterli spedire al frontend)
func (g *Game) GetEvents() []event.DomainEvent {
	return g.domainEvents
}

// ClearEvents svuota la coda dopo che gli eventi sono stati salvati/spediti
func (g *Game) ClearEvents() {
	g.domainEvents = nil
}