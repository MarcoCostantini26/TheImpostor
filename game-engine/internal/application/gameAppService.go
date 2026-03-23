package application

import (
	"errors"

	"game-engine/internal/domain/aggregate"
	"game-engine/internal/domain/repository"
	"game-engine/internal/domain/service"
)

// GameAppService è l'orchestratore dei casi d'uso della partita
type GameAppService struct {
	gameRepo    repository.GameRepository
	gameFactory *aggregate.GameFactory
	rulesSvc    *service.GameRulesService
}

// NewGameAppService è il costruttore dell'Application Service
func NewGameAppService(
	repo repository.GameRepository,
	factory *aggregate.GameFactory,
	rules *service.GameRulesService,
) *GameAppService {
	return &GameAppService{
		gameRepo:    repo,
		gameFactory: factory,
		rulesSvc:    rules,
	}
}

// ==========================================
// CASI D'USO (USE CASES)
// ==========================================

// CreateGameUseCase gestisce la richiesta di creazione di una nuova partita dalla Lobby
func (app *GameAppService) CreateGameUseCase(gameID string, playerIDs []string, requestedImpostors int) error {
	// 1. La Factory crea la partita validando tutte le regole
	game, err := app.gameFactory.CreateGame(gameID, playerIDs, requestedImpostors)
	if err != nil {
		return err 
	}

	// 2. Salviamo la partita appena nata nel DB/Memoria
	return app.gameRepo.Save(game)
}

// AdvanceToVotingUseCase sposta il gioco nella fase di voto
func (app *GameAppService) AdvanceToVotingUseCase(gameID string) error {
	game, err := app.gameRepo.FindByID(gameID)
	if err != nil {
		return err
	}
	if game == nil {
		return errors.New("partita non trovata")
	}

	// Chiamiamo la logica di dominio
	err = game.AdvanceToVoting()
	if err != nil {
		return err
	}

	return app.gameRepo.Save(game)
}

// CastVoteUseCase orchestra l'azione di voto di un giocatore
func (app *GameAppService) CastVoteUseCase(gameID string, voterID string, targetID string) error {
	game, err := app.gameRepo.FindByID(gameID)
	if err != nil {
		return err
	}
	if game == nil {
		return errors.New("partita non trovata")
	}

	err = game.CastVote(voterID, targetID)
	if err != nil {
		return err
	}

	return app.gameRepo.Save(game)
}

// ResolveVotingUseCase chiude i voti, elimina l'eventuale giocatore e controlla se qualcuno ha vinto!
func (app *GameAppService) ResolveVotingUseCase(gameID string) error {
	game, err := app.gameRepo.FindByID(gameID)
	if err != nil {
		return err
	}
	if game == nil {
		return errors.New("partita non trovata")
	}

	// 1. Risolviamo i voti (il file game.go decide se e chi muore)
	_, err = game.ResolveVoting()
	if err != nil {
		return err
	}

	// 2. CONTROLLO VITTORIA: Il momento in cui i vari pezzi del dominio collaborano!
	// Chiediamo all'arbitro (GameRulesService) se l'eliminazione ha fatto vincere qualcuno.
	winTeam := app.rulesSvc.CheckWinCondition(game)
	
	// Se qualcuno ha vinto (quindi non è "NONE")
	if winTeam != service.WinNone { 
		// Diciamo al gioco di chiudersi e dichiarare il vincitore
		err = game.EndGame(winTeam)
		if err != nil {
			return err
		}
	}

	// 3. Salviamo il tutto
	return app.gameRepo.Save(game)
}