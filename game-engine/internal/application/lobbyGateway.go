package application

import "time"

type LobbyGateway interface {
	CreateGameSession(gameID string, playerIDs []string, hostID string) error

	SaveRoundResult(payload LobbyRoundResult) error
}

type LobbyRoundResult struct {
	RoomCode            string
	RoundNumber         int
	ImpostorID          string
	WinnerID            string // ID dell'impostore se vince lui, altrimenti vuoto
	ImpostorWon         bool
	StartedAt           time.Time
	EndedAt             time.Time
	TotalVotes          int
	EliminatedPlayerID  string
	ImpostorGuessedWord bool
	SecretWord          string
}
