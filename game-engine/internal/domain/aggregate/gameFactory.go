package aggregate

import (
	"errors"
	"math/rand"
	"time"

	"game-engine/internal/domain/entity"
	"game-engine/internal/domain/event"
	"game-engine/internal/domain/valueobject"
)

var (
	ErrNotEnoughPlayers     = errors.New("una partita richiede almeno 4 giocatori")
	ErrTooManyPlayers       = errors.New("una partita non può avere più di 8 giocatori")
	ErrInvalidImpostorCount = errors.New("numero di impostori richiesto non consentito per questo numero di giocatori")
)

// CalculateMaxImpostors restituisce il numero massimo di impostori consentito 
// in base al numero di giocatori presenti.
func CalculateMaxImpostors(playerCount int) int {
	if playerCount >= 6 {
		return 2
	}
	return 1 // Per 4 o 5 giocatori, massimo 1 impostore
}

// GameFactory espone i metodi per creare partite valide rispettando le regole di dominio
type GameFactory struct{}

// NewGameFactory crea una nuova istanza della factory
func NewGameFactory() *GameFactory {
	return &GameFactory{}
}

func (f *GameFactory) CreateGame(gameID string, playerIDs []string, requestedImpostors int) (*Game, error) {
	numPlayers := len(playerIDs)

	// 1. Validazione Invarianti base (minimo 4, massimo 8)
	if numPlayers < 4 {
		return nil, ErrNotEnoughPlayers
	}
	if numPlayers > 8 {
		return nil, ErrTooManyPlayers
	}

	// 2. Calcoliamo il massimo consentito
	maxImpostors := CalculateMaxImpostors(numPlayers)

	// 3. Validazione della richiesta della Lobby
	if requestedImpostors < 1 || requestedImpostors > maxImpostors {
		return nil, ErrInvalidImpostorCount
	}

	// 4. Selezione casuale
	shuffledIndices := rand.Perm(numPlayers)
	impostorIndices := shuffledIndices[:requestedImpostors]

	isImpostor := func(index int) bool {
		for _, v := range impostorIndices {
			if v == index {
				return true
			}
		}
		return false
	}

	// 5. Creazione giocatori
	var players []entity.Player
	for i, pid := range playerIDs {
		role := valueobject.RoleCrewmate
		if isImpostor(i) {
			role = valueobject.RoleImpostor
		}
		players = append(players, entity.Player{
			ID:     pid,
			Status: "ALIVE",
			Role:   role,
		})
	}

	// 6. Creazione Aggregate
	game := &Game{
		ID:      gameID,
		State:   StatePlaying,
		Players: players,
		CurrentTurn: valueobject.Turn{
			RoundNumber: 1,
			Phase:       valueobject.PhaseDiscussion,
			Timer:       120,
		},
		Votes: make([]valueobject.Vote, 0),
	}

	// 7. Evento
	startedEvent := event.GameStarted{
		BaseEvent: event.BaseEvent{OccurredAt: time.Now()},
		GameID:    game.ID,
	}
	game.RecordEvent(startedEvent)

	return game, nil
}