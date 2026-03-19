package repository

import (
	"game-engine/internal/domain/aggregate"
)

// GameRepository definisce come il sistema salva e recupera le partite.
// La vera implementazione (es. in memoria) starà fuori dal dominio.
type GameRepository interface {
	Save(game *aggregate.Game) error
	FindByID(id string) (*aggregate.Game, error)
	Delete(id string) error
}