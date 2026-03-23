package entity

import "game-engine/internal/domain/valueobject"

type Player struct {
	ID     string
	Status string 			//(DEAD or ALIVE)
	Role   valueobject.Role
}