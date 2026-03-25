package main

import (
	"fmt"
	"log"
	"net/http"

	"game-engine/internal/application"
	"game-engine/internal/domain/aggregate"
	"game-engine/internal/domain/service"
	gameapi "game-engine/internal/infrastructure/http"
	"game-engine/internal/infrastructure/memory"
)

func main() {
	fmt.Println("Avvio fase di cablaggio del Game Engine...")

	// 1. Creiamo il Frigorifero (Il database in RAM)
	repo := memory.NewInMemoryGameRepository()

	// 2. Creiamo gli strumenti di base del dominio
	factory := aggregate.NewGameFactory()
	rules := service.NewGameRulesService()

	// 3. Assumiamo lo Chef e gli diamo gli strumenti
	appService := application.NewGameAppService(repo, factory, rules)

	// 4. Assumiamo il Cameriere e gli presentiamo lo Chef
	controller := gameapi.NewGameController(appService)

	// 5. Prepariamo la Mappa del Ristorante (Rotte HTTP)
	mux := http.NewServeMux()
	
	// Qui diciamo al server quali URL corrispondono a quali funzioni
	mux.HandleFunc("/games/create", controller.HandleCreateGame)
	mux.HandleFunc("/games/advance-voting", controller.HandleAdvanceToVoting)
	mux.HandleFunc("/games/vote", controller.HandleCastVote)
	mux.HandleFunc("/games/resolve-voting", controller.HandleResolveVoting)

	// 6. Alziamo la serranda! (Avviamo il server sulla porta 8081)
	fmt.Println("🚀 Game Engine acceso e in ascolto sulla porta 8081!")
	
	// Ascoltiamo sulla porta che hai scelto tu:
	err := http.ListenAndServe(":8081", mux)
	if err != nil {
		log.Fatalf("Il server si è schiantato: %v", err)
	}
}