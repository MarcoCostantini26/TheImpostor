package http

import (
	"encoding/json"
	"net/http"

	"game-engine/internal/application"
)

// GameController gestisce le richieste HTTP in entrata
type GameController struct {
	appService *application.GameAppService
}

func NewGameController(appService *application.GameAppService) *GameController {
	return &GameController{
		appService: appService,
	}
}

type CreateGameRequest struct {
	GameID             string   `json:"gameId"`
	PlayerIDs          []string `json:"playerIds"`
	RequestedImpostors int      `json:"requestedImpostors"`
	SecretWord         string   `json:"secretWord"`
	Hint               string   `json:"hint"`
}

type CastVoteRequest struct {
	VoterID  string `json:"voterId"`
	TargetID string `json:"targetId"` 
}

type GuessWordRequest struct {
	ImpostorID  string `json:"impostorId"`
	GuessedWord string `json:"guessedWord"`
}

func (c *GameController) HandleCreateGame(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	var req CreateGameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON non valido", http.StatusBadRequest)
		return
	}

	err := c.appService.CreateGameUseCase(req.GameID, req.PlayerIDs, req.RequestedImpostors, req.SecretWord, req.Hint)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Partita creata con successo"})
}

func (c *GameController) HandleAdvanceToVoting(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	gameID := r.URL.Query().Get("gameId")
	if gameID == "" {
		http.Error(w, "Manca il gameId", http.StatusBadRequest)
		return
	}

	err := c.appService.AdvanceToVotingUseCase(gameID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Fase di voto iniziata"})
}

func (c *GameController) HandleCastVote(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	gameID := r.URL.Query().Get("gameId")
	if gameID == "" {
		http.Error(w, "Manca il gameId", http.StatusBadRequest)
		return
	}

	var req CastVoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON non valido", http.StatusBadRequest)
		return
	}

	err := c.appService.CastVoteUseCase(gameID, req.VoterID, req.TargetID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Voto registrato in segreto"})
}

func (c *GameController) HandleResolveVoting(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	gameID := r.URL.Query().Get("gameId")
	if gameID == "" {
		http.Error(w, "Manca il gameId", http.StatusBadRequest)
		return
	}

	err := c.appService.ResolveVotingUseCase(gameID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Votazione conclusa. Eventuali giocatori eliminati e condizioni di vittoria controllate."})
}

func (c *GameController) HandleGetGameState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	gameID := r.URL.Query().Get("gameId")
	game, err := c.appService.GetGameUseCase(gameID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if game == nil {
		http.Error(w, "Partita non trovata", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(game)
}

func (c *GameController) HandleGuessWord(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	gameID := r.URL.Query().Get("gameId")
	if gameID == "" {
		http.Error(w, "Manca il gameId", http.StatusBadRequest)
		return
	}

	var req GuessWordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON non valido", http.StatusBadRequest)
		return
	}

	err := c.appService.GuessSecretWordUseCase(gameID, req.ImpostorID, req.GuessedWord)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Tentativo registrato"})
}