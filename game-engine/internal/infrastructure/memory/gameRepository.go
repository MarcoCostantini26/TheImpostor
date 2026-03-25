package memory

import (
	"errors"
	"sync"

	"game-engine/internal/domain/aggregate"
)

// InMemoryGameRepository è l'implementazione in RAM dell'interfaccia GameRepository
type InMemoryGameRepository struct {
	mu    sync.RWMutex // Il "lucchetto" per la concorrenza
	games map[string]*aggregate.Game
}

// NewInMemoryGameRepository crea un nuovo database in memoria vuoto
func NewInMemoryGameRepository() *InMemoryGameRepository {
	return &InMemoryGameRepository{
		games: make(map[string]*aggregate.Game),
	}
}

// Save inserisce o aggiorna una partita nella mappa
func (r *InMemoryGameRepository) Save(game *aggregate.Game) error {
	if game == nil {
		return errors.New("impossibile salvare una partita nulla")
	}

	r.mu.Lock()         // Blocca in scrittura
	defer r.mu.Unlock() // Sblocca quando ha finito

	r.games[game.ID] = game
	return nil
}

// FindByID cerca una partita per ID. Restituisce nil se non la trova.
func (r *InMemoryGameRepository) FindByID(id string) (*aggregate.Game, error) {
	r.mu.RLock()         // Blocca in sola lettura
	defer r.mu.RUnlock()

	game, exists := r.games[id]
	if !exists {
		return nil, nil
	}

	return game, nil
}

// Delete rimuove una partita dalla memoria 
func (r *InMemoryGameRepository) Delete(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.games, id)
	return nil
}