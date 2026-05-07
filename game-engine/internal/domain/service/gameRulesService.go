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

	if impostorsAlive == 0 {
		return WinCrewmates
	}

	if crewmatesAlive <= impostorsAlive {
		return WinImpostors
	}

	return WinNone
}