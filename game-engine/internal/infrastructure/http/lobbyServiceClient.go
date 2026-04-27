package http

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"game-engine/internal/application"
)

// Implementa application.LobbyGateway chiamando il Lobby Service via HTTP.
type LobbyServiceClient struct {
	baseURL string
}

// Crea un client puntato all'URL base del Lobby Service.
func NewLobbyServiceClient(baseURL string) *LobbyServiceClient {
	return &LobbyServiceClient{baseURL: baseURL}
}

// ----- DTOs -----

type createSessionRequest struct {
	RoomCode        string   `json:"roomCode"`
	PlayerIDs       []string `json:"playerIds"`
	PlayerUsernames []string `json:"playerUsernames"`
	HostID          string   `json:"hostId"`
}

type roundResultRequest struct {
	RoundNumber              int    `json:"roundNumber"`
	ImpostorID               string `json:"impostorId"`
	ImpostorUsername         string `json:"impostorUsername"`
	WinnerID                 string `json:"winnerId,omitempty"`
	ImpostorWon              bool   `json:"impostorWon"`
	StartedAt                string `json:"startedAt"`
	EndedAt                  string `json:"endedAt"`
	TotalVotes               int    `json:"totalVotes"`
	EliminatedPlayerID       string `json:"eliminatedPlayerId,omitempty"`
	EliminatedPlayerUsername string `json:"eliminatedPlayerUsername,omitempty"`
	ImpostorGuessedWord      bool   `json:"impostorGuessedWord"`
	SecretWord               string `json:"secretWord,omitempty"`
}

// ----- Interface implementation -----

// Chiama POST /api/internal/games/session.
// Gli username vengono impostati uguali agli ID
func (c *LobbyServiceClient) CreateGameSession(gameID string, playerIDs []string, hostID string) error {
	usernames := make([]string, len(playerIDs))
	copy(usernames, playerIDs)

	req := createSessionRequest{
		RoomCode:        gameID,
		PlayerIDs:       playerIDs,
		PlayerUsernames: usernames,
		HostID:          hostID,
	}

	if err := c.post(fmt.Sprintf("/api/internal/games/session"), req); err != nil {
		fmt.Printf("⚠️ [LobbyClient] CreateGameSession fallita per %s: %v\n", gameID, err)
		return err
	}

	fmt.Printf("✅ [LobbyClient] Sessione registrata nel Lobby Service per room %s\n", gameID)
	return nil
}

// Chiama POST /api/internal/games/{roomCode}/round-result.
// Gli username vengono impostati uguali agli ID quando non disponibili.
func (c *LobbyServiceClient) SaveRoundResult(payload application.LobbyRoundResult) error {
	req := roundResultRequest{
		RoundNumber:              payload.RoundNumber,
		ImpostorID:               payload.ImpostorID,
		ImpostorUsername:         payload.ImpostorID, // fallback: ID usato come username
		WinnerID:                 payload.WinnerID,
		ImpostorWon:              payload.ImpostorWon,
		StartedAt:                payload.StartedAt.UTC().Format(time.RFC3339),
		EndedAt:                  payload.EndedAt.UTC().Format(time.RFC3339),
		TotalVotes:               payload.TotalVotes,
		EliminatedPlayerID:       payload.EliminatedPlayerID,
		EliminatedPlayerUsername: payload.EliminatedPlayerID, // fallback
		ImpostorGuessedWord:      payload.ImpostorGuessedWord,
		SecretWord:               payload.SecretWord,
	}

	path := fmt.Sprintf("/api/internal/games/%s/round-result", payload.RoomCode)
	if err := c.post(path, req); err != nil {
		fmt.Printf("⚠️ [LobbyClient] SaveRoundResult fallita per %s round %d: %v\n",
			payload.RoomCode, payload.RoundNumber, err)
		return err
	}

	fmt.Printf("✅ [LobbyClient] Risultato round %d salvato per room %s\n",
		payload.RoundNumber, payload.RoomCode)
	return nil
}

// Esegue una richiesta HTTP POST verso il Lobby Service.
func (c *LobbyServiceClient) post(path string, body interface{}) error {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}

	url := c.baseURL + path
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("request error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("lobby service returned status %d", resp.StatusCode)
	}
	return nil
}
