package entity

import "game-engine/internal/domain/valueobject"

type Player struct {
	ID     string
	Status string 			//(playing or eliminated)
	Role   valueobject.Role
}