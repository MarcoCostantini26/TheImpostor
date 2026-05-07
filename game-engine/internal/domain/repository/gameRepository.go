package repository

import (
	"game-engine/internal/domain/aggregate"
)

type GameRepository interface {
	Save(game *aggregate.Game) error
	FindByID(id string) (*aggregate.Game, error)
	Delete(id string) error
}