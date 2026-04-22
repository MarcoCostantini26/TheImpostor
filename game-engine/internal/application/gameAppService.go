package application

import (
	"errors"

	"game-engine/internal/domain/aggregate"
	"game-engine/internal/domain/repository"
	"game-engine/internal/domain/service"
)

type GameAppService struct {
	gameRepo    repository.GameRepository
	gameFactory *aggregate.GameFactory
	rulesSvc    *service.GameRulesService
	notifier    GatewayNotifier
}

func NewGameAppService(
	repo repository.GameRepository,
	factory *aggregate.GameFactory,
	rules *service.GameRulesService,
	notifier GatewayNotifier,
) *GameAppService {
	return &GameAppService{
		gameRepo:    repo,
		gameFactory: factory,
		rulesSvc:    rules,
		notifier:    notifier,
	}
}

func (app *GameAppService) CreateGameUseCase(gameID string, playerIDs []string, requestedImpostors int, secretWord string, hint string) error {

	game, err := app.gameFactory.CreateGame(gameID, playerIDs, requestedImpostors, secretWord, hint)
	if err != nil {
		return err
	}
	err = app.gameRepo.Save(game)
	if err != nil {
		return err
	}

	app.notifier.NotifyEvent("GameCreated", game)
	return nil
}

func (app *GameAppService) AdvanceToVotingUseCase(gameID string) error {
	game, err := app.gameRepo.FindByID(gameID)
	if err != nil || game == nil {
		return errors.New("partita non trovata")
	}

	err = game.AdvanceToVoting()
	if err != nil {
		return err
	}
	app.gameRepo.Save(game)

	app.notifier.NotifyEvent("PhaseChanged", map[string]string{"gameId": gameID, "newPhase": "VOTING"})
	return nil
}

func (app *GameAppService) CastVoteUseCase(gameID string, voterID string, targetID string) error {
	game, err := app.gameRepo.FindByID(gameID)
	if err != nil || game == nil {
		return errors.New("partita non trovata")
	}

	err = game.CastVote(voterID, targetID)
	if err != nil {
		return err
	}
	app.gameRepo.Save(game)

	app.notifier.NotifyEvent("PlayerVoted", map[string]string{
		"gameId":   gameID,
		"voterId":  voterID,
		"targetId": targetID,
	})
	return nil
}

func (app *GameAppService) ResolveVotingUseCase(gameID string) error {
	game, err := app.gameRepo.FindByID(gameID)
	if err != nil || game == nil {
		return errors.New("partita non trovata")
	}

	eliminatedID, err := game.ResolveVoting()
	if err != nil {
		return err
	}

	if eliminatedID != "" {
		if string(game.GetPlayerRole(eliminatedID)) == "IMPOSTOR" {
			game.StartGuessingPhase()
			app.gameRepo.Save(game)

			app.notifier.NotifyEvent("ImpostorGuessPhase", map[string]string{
				"gameId":     gameID,
				"impostorId": eliminatedID,
			})
			return nil
		}
	}

	winTeam := app.rulesSvc.CheckWinCondition(game)
	if winTeam != service.WinNone {
		game.EndGame(string(winTeam))
		app.gameRepo.Save(game)
		app.notifier.NotifyEvent("GameEnded", map[string]string{"gameId": gameID, "winner": string(winTeam)})
		return nil
	}

	eliminatedRole := ""
	if eliminatedID != "" {
		eliminatedRole = game.GetPlayerRole(eliminatedID)
	}

	game.StartNewRound()
	app.gameRepo.Save(game)
	app.notifier.NotifyEvent("VotingResolved", map[string]string{
		"gameId":         gameID,
		"eliminatedId":   eliminatedID,
		"eliminatedRole": eliminatedRole,
	})
	return nil
}

func (app *GameAppService) GetGameUseCase(gameID string) (interface{}, error) {
	game, err := app.gameRepo.FindByID(gameID)
	if err != nil {
		return nil, err
	}
	if game == nil {
		return nil, errors.New("partita non trovata")
	}
	return game, nil
}

func (app *GameAppService) GuessSecretWordUseCase(gameID string, impostorID string, guessedWord string) error {
	game, err := app.gameRepo.FindByID(gameID)
	if err != nil {
		return err
	}
	if game == nil {
		return errors.New("partita non trovata")
	}

	if string(game.CurrentTurn.Phase) != "GUESSING_WORD" {
		return errors.New("non è il momento di indovinare la parola")
	}

	if game.CheckSecretWord(guessedWord) {
		game.EndGame("IMPOSTOR_WINS")
		app.gameRepo.Save(game)
		app.notifier.NotifyEvent("GameEnded", map[string]string{
			"gameId": gameID,
			"winner": "IMPOSTOR_WINS",
			"reason": "WORD_GUESSED",
		})
	} else {
		game.EndGame("CREWMATES_WIN")
		app.gameRepo.Save(game)
		app.notifier.NotifyEvent("GameEnded", map[string]string{
			"gameId": gameID,
			"winner": "CREWMATES_WIN",
			"reason": "WRONG_GUESS",
		})
	}

	return nil
}
