package aggregate

import (
	"game-engine/internal/domain/entity"
	"game-engine/internal/domain/valueobject"
)

type Game struct {
	ID          string
	State       string // es. "WAITING", "PLAYING", "ENDED"
	Timer       int
	Players     []entity.Player
	//CurrentTurn valueobject.Turn
	//Word        valueobject.Word
	//Hint        valueobject.Hint
	//Votes       []valueobject.Vote
}