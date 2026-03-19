package aggregate

import (
	"game-engine/internal/domain/entity"
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
}