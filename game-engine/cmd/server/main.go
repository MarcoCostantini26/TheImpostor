package main

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"game-engine/internal/application"
	"game-engine/internal/domain/aggregate"
	"game-engine/internal/domain/service"
	gameapi "game-engine/internal/infrastructure/http"
	"game-engine/internal/infrastructure/memory"
)

func main() {
	rand.Seed(time.Now().UnixNano())

	fmt.Println("Avvio fase di cablaggio del Game Engine...")

	repo := memory.NewInMemoryGameRepository()

	factory := aggregate.NewGameFactory()
	rules := service.NewGameRulesService()

	commServiceURL := os.Getenv("COMM_SERVICE_URL")
	if commServiceURL == "" {
		commServiceURL = "http://localhost:3000"
	}

	notifierURL := commServiceURL + "/internal/engine-callback"

	webhookNotifier := gameapi.NewHTTPGatewayNotifier(notifierURL)

	appService := application.NewGameAppService(repo, factory, rules, webhookNotifier)

	controller := gameapi.NewGameController(appService)

	mux := http.NewServeMux()

	mux.HandleFunc("/games/create", controller.HandleCreateGame)
	mux.HandleFunc("/games/advance-voting", controller.HandleAdvanceToVoting)
	mux.HandleFunc("/games/vote", controller.HandleCastVote)
	mux.HandleFunc("/games/resolve-voting", controller.HandleResolveVoting)
	mux.HandleFunc("/games/state", controller.HandleGetGameState)
	mux.HandleFunc("/games/guess-word", controller.HandleGuessWord)

	fmt.Println("🚀 Game Engine acceso e in ascolto sulla porta 8081!")

	err := http.ListenAndServe(":8081", mux)
	if err != nil {
		log.Fatalf("Il server si è schiantato: %v", err)
	}
}
