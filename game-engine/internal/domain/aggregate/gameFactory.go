package aggregate

import (
	"errors"
	"math/rand"
	"time"

	"game-engine/internal/domain/entity"
	"game-engine/internal/domain/event"
	"game-engine/internal/domain/valueobject"
)

// ErrNotEnoughPlayers viene restituito se si tenta di avviare una partita con meno di 4 giocatori
var ErrNotEnoughPlayers = errors.New("una partita richiede almeno 4 giocatori")

// GameFactory espone i metodi per creare partite valide rispettando le regole di dominio
type GameFactory struct{}

// NewGameFactory crea una nuova istanza della factory
func NewGameFactory() *GameFactory {
	return &GameFactory{}
}

// CreateGame inizializza un nuovo Game Aggregate, assegna i ruoli e genera l'evento di inizio partita
func (f *GameFactory) CreateGame(gameID string, playerIDs []string) (*Game, error) {
	// 1. Validazione delle Invarianti (minimo 4 giocatori)
	if len(playerIDs) < 4 {
		return nil, ErrNotEnoughPlayers
	}

	// 2. Assegnazione casuale dei ruoli
	// (In Go 1.24+ il generatore math/rand è già inizializzato in automatico in modo sicuro)
	impostorIndex := rand.Intn(len(playerIDs))

	var players []entity.Player
	for i, pid := range playerIDs {
		role := valueobject.RoleCrewmate
		if i == impostorIndex {
			role = valueobject.RoleImpostor
		}

		players = append(players, entity.Player{
			ID:     pid,
			Status: "ALIVE", // Stato iniziale standard
			Role:   role,
		})
	}

	// 3. Creazione dell'Aggregate Root nel suo stato iniziale
	game := &Game{
		ID:      gameID,
		State:   StatePlaying,
		Players: players,
		CurrentTurn: valueobject.Turn{
			RoundNumber: 1,
			Phase:       valueobject.PhaseDiscussion,
			Timer:       120, // Esempio: 120 secondi per la fase di discussione
		},
		Votes: make([]valueobject.Vote, 0),
		// domainEvents è inizializzato a nil di default, va benissimo così
	}

	// 4. Generazione e registrazione del Domain Event "GameStarted"
	startedEvent := event.GameStarted{
		BaseEvent: event.BaseEvent{OccurredAt: time.Now()},
		GameID:    game.ID,
	}
	
	// Il gioco si "appunta" l'evento appena nato
	game.RecordEvent(startedEvent)

	return game, nil
}