package service

import (
	"game-engine/internal/domain/aggregate"
	"game-engine/internal/domain/valueobject"
)

const (
	WinCrewmates = "CREWMATES_WIN"
	WinImpostors = "IMPOSTOR_WINS"
	WinNone      = "NONE"
)

type GameRulesService struct{}

func NewGameRulesService() *GameRulesService {
	return &GameRulesService{}
}

func (s *GameRulesService) CheckWinCondition(game *aggregate.Game) string {
	impostorsAlive := 0
	crewmatesAlive := 0

	for _, p := range game.Players {
		if p.Status == "ALIVE" {
			if p.Role == valueobject.RoleImpostor {
				impostorsAlive++
			} else {
				crewmatesAlive++
			}
		}
	}

	// Regola 1: Se l'impostore muore, vincono i Crewmate
	if impostorsAlive == 0 {
		return WinCrewmates
	}

	// Regola 2: Se i Crewmate vivi sono <= degli Impostori, vince l'Impostore
	if crewmatesAlive <= impostorsAlive {
		return WinImpostors
	}

	// Nessuno ha ancora vinto
	return WinNone
}