package aggregate

import (
	"errors"
	"math/rand"

	"game-engine/internal/domain/entity"
	"game-engine/internal/domain/valueobject"
)

var ErrNotEnoughPlayers = errors.New("una partita richiede almeno 4 giocatori")

type GameFactory struct{}

func NewGameFactory() *GameFactory {
	return &GameFactory{}
}

// CreateGame riceve un ID partita e una lista di ID giocatori dalla Lobby,
// e restituisce un Aggregate Root 'Game' pronto per essere giocato.
func (f *GameFactory) CreateGame(gameID string, playerIDs []string) (*Game, error) {
	if len(playerIDs) < 4 {
		return nil, ErrNotEnoughPlayers
	}

	impostorIndex := rand.Intn(len(playerIDs))
	
	var players []entity.Player
	for i, pid := range playerIDs {
		role := valueobject.RoleCrewmate
		if i == impostorIndex {
			role = valueobject.RoleImpostor
		}

		players = append(players, entity.Player{
			ID:     pid,
			Status: "ALIVE", 
			Role:   role,
		})
	}

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

	return game, nil
}