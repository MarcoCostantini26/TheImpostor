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

// wordPairs contains [secretWord, hint] pairs used to assign secrets each game.
var wordPairs = [][2]string{
	{"PIZZA", "ITALIAN DISH"},
	{"GUITAR", "MUSICAL INSTRUMENT"},
	{"VOLCANO", "FIRE MOUNTAIN"},
	{"SUBMARINE", "UNDERWATER VESSEL"},
	{"JUNGLE", "TROPICAL FOREST"},
	{"CASTLE", "MEDIEVAL FORTRESS"},
	{"COMPASS", "NAVIGATION TOOL"},
	{"TELESCOPE", "USED FOR STARGAZING"},
	{"DINOSAUR", "ANCIENT CREATURE"},
	{"TORNADO", "SPINNING STORM"},
	{"DIAMOND", "PRECIOUS GEMSTONE"},
	{"LIGHTHOUSE", "GUIDES SAILORS"},
	{"PARACHUTE", "SKYDIVING TOOL"},
	{"AVALANCHE", "SNOW SLIDE"},
	{"TREASURE", "HIDDEN RICHES"},
}

func CalculateMaxImpostors(playerCount int) int {
	if playerCount >= 6 {
		return 2
	}
	return 1
}

type GameFactory struct{}

func NewGameFactory() *GameFactory {
	return &GameFactory{}
}

// Nota: ho tolto 'secretWord string' dai parametri, perché ora la sceglie lui!
func (f *GameFactory) CreateGame(gameID string, playerIDs []string, requestedImpostors int) (*Game, error) {
	numPlayers := len(playerIDs)

	if numPlayers < 4 {
		return nil, ErrNotEnoughPlayers
	}
	if numPlayers > 8 {
		return nil, ErrTooManyPlayers
	}

	maxImpostors := CalculateMaxImpostors(numPlayers)
	if requestedImpostors < 1 || requestedImpostors > maxImpostors {
		return nil, ErrInvalidImpostorCount
	}

	shuffledPlayerIDs := make([]string, len(playerIDs))
	copy(shuffledPlayerIDs, playerIDs)

	rand.Shuffle(len(shuffledPlayerIDs), func(i, j int) {
		shuffledPlayerIDs[i], shuffledPlayerIDs[j] = shuffledPlayerIDs[j], shuffledPlayerIDs[i]
	})

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

	var players []entity.Player
	for i, pid := range shuffledPlayerIDs {
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

	pair := wordPairs[rand.Intn(len(wordPairs))]

	game := &Game{
		ID:      gameID,
		State:   StatePlaying,
		Players: players,
		CurrentTurn: valueobject.Turn{
			RoundNumber: 1,
			Phase:       valueobject.PhaseDiscussion,
			Timer:       120,
		},
		Votes:      make([]valueobject.Vote, 0),
		SecretWord: valueobject.SecretWord(pair[0]),
		Hint:       valueobject.Hint(pair[1]),
	}

	startedEvent := event.GameStarted{
		BaseEvent: event.BaseEvent{OccurredAt: time.Now()},
		GameID:    game.ID,
	}
	game.RecordEvent(startedEvent)

	return game, nil
}