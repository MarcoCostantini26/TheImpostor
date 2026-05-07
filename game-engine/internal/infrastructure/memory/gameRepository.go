package memory

import (
	"errors"
	"sync"

	"game-engine/internal/domain/aggregate"
)

type InMemoryGameRepository struct {
	mu    sync.RWMutex // Il "lucchetto" per la concorrenza
	games map[string]*aggregate.Game
}

func NewInMemoryGameRepository() *InMemoryGameRepository {
	return &InMemoryGameRepository{
		games: make(map[string]*aggregate.Game),
	}
}

func (r *InMemoryGameRepository) Save(game *aggregate.Game) error {
	if game == nil {
		return errors.New("impossibile salvare una partita nulla")
	}

	r.mu.Lock()        
	defer r.mu.Unlock() 

	r.games[game.ID] = game
	return nil
}

func (r *InMemoryGameRepository) FindByID(id string) (*aggregate.Game, error) {
	r.mu.RLock()         // Blocca in sola lettura
	defer r.mu.RUnlock()

	game, exists := r.games[id]
	if !exists {
		return nil, nil
	}

	return game, nil
}

func (r *InMemoryGameRepository) Delete(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.games, id)
	return nil
}