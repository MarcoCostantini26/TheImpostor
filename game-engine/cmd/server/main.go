package main

import (
	"fmt"
	"net/http"
)

func main() {
	fmt.Println("Game Engine avviato e in ascolto sulla porta 8081...")

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Engine is alive and kicking!"))
	})

	err := http.ListenAndServe(":8081", nil)
	if err != nil {
		fmt.Printf("Errore critico del server: %v\n", err)
	}
}