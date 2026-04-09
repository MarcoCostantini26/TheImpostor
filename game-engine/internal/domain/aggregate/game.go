package aggregate

import (
	"errors"
	"time"
	"strings"

	"game-engine/internal/domain/entity"
	"game-engine/internal/domain/event"
	"game-engine/internal/domain/valueobject"
)

const (
	StateWaiting = "WAITING"
	StatePlaying = "PLAYING"
	StateEnded   = "ENDED"
)

type Game struct {
	ID          string
	State       string
	Players     []entity.Player
	CurrentTurn valueobject.Turn
	SecretWord        valueobject.SecretWord
	Votes       []valueobject.Vote
	domainEvents []event.DomainEvent 
}

// ==========================================
// METODI PER LA GESTIONE DEGLI EVENTI
// ==========================================

// RecordEvent aggiunge un nuovo evento alla coda del gioco
func (g *Game) RecordEvent(e event.DomainEvent) {
	g.domainEvents = append(g.domainEvents, e)
}

// GetEvents restituisce tutti gli eventi accumulati (per poterli spedire al frontend)
func (g *Game) GetEvents() []event.DomainEvent {
	return g.domainEvents
}

// ClearEvents svuota la coda dopo che gli eventi sono stati salvati/spediti
func (g *Game) ClearEvents() {
	g.domainEvents = nil
}

// ==========================================
// COMPORTAMENTI DEL GIOCO (LOGICA DI BUSINESS)
// ==========================================

// AdvanceToVoting cambia la fase del turno corrente, passando dalla discussione al voto.
func (g *Game) AdvanceToVoting() error {
	if g.State != StatePlaying {
		return errors.New("la partita non è in corso")
	}
	if g.CurrentTurn.Phase != valueobject.PhaseDiscussion {
		return errors.New("il gioco non è in fase di discussione")
	}

	// 1. Cambiamo la fase in VOTING e resettiamo il timer
	g.CurrentTurn.Phase = valueobject.PhaseVoting
	g.CurrentTurn.Timer = 60
	
	// 2. Resettiamo eventuali voti precedenti (in caso di round successivi al primo)
	g.Votes = make([]valueobject.Vote, 0)

	// 3. Registriamo l'evento! Il Node.js leggerà questo e dirà al frontend di mostrare la UI di voto
	g.RecordEvent(event.PhaseChanged{
		BaseEvent: event.BaseEvent{OccurredAt: time.Now()},
		GameID:    g.ID,
		NewPhase:  string(valueobject.PhaseVoting),
		Timer:     60,
	})

	return nil
}

// CastVote permette a un giocatore di esprimere il suo voto (o skippare se targetID è vuoto)
func (g *Game) CastVote(voterID string, targetID string) error {
	if g.State != StatePlaying {
		return errors.New("la partita non è in corso")
	}

	if g.CurrentTurn.Phase != valueobject.PhaseVoting {
		return errors.New("non è il momento di votare")
	}

	// 1. Controlliamo che il votante esista e sia vivo
	voterIndex := g.getPlayerIndex(voterID)
	if voterIndex == -1 {
		return errors.New("giocatore votante non trovato")
	}
	if g.Players[voterIndex].Status != "ALIVE" {
		return errors.New("i giocatori eliminati non possono votare")
	}

	// 2. Registriamo il voto fisicamente nella memoria del gioco
	vote := valueobject.Vote{
		VoterID:  voterID,
		TargetID: targetID, 
	}
	g.Votes = append(g.Votes, vote)

	// 3. Registriamo l'evento (così gli altri giocatori vedranno che lui ha votato)
	g.RecordEvent(event.PlayerVoted{
		BaseEvent: event.BaseEvent{OccurredAt: time.Now()},
		GameID:    g.ID,
		VoterID:   voterID,
	})

	return nil
}

// getPlayerIndex è una funzione di supporto "privata" per trovare la posizione di un giocatore
func (g *Game) getPlayerIndex(playerID string) int {
	for i, p := range g.Players {
		if p.ID == playerID {
			return i
		}
	}
	return -1 
}

// EndGame viene chiamato dall'Application Layer quando il GameRulesService
// rileva che c'è un vincitore. Congela il gioco e annuncia la fine.
func (g *Game) EndGame(winningTeam string) error {
	if g.State == StateEnded {
		return errors.New("la partita è già finita")
	}

	// La partita è chiusa
	g.State = StateEnded

	// Appunta l'evento finale per il Frontend
	g.RecordEvent(event.GameEnded{
		BaseEvent:   event.BaseEvent{OccurredAt: time.Now()},
		GameID:      g.ID,
		WinningTeam: winningTeam,
	})

	return nil
}

// ResolveVoting chiude la fase di voto, conta i voti e (se c'è una maggioranza) elimina un giocatore.
// Restituisce l'ID del giocatore eliminato, oppure una stringa vuota se c'è stato un pareggio o uno skip.
func (g *Game) ResolveVoting() (string, error) {
	if g.State != StatePlaying {
		return "", errors.New("la partita non è in corso")
	}
	if g.CurrentTurn.Phase != valueobject.PhaseVoting {
		return "", errors.New("non siamo in fase di votazione")
	}

	// 1. Contiamo i voti usando una Mappa
	voteCounts := make(map[string]int)
	for _, v := range g.Votes {
		target := v.TargetID
		if target == "" {
			target = "SKIP" // Consideriamo i voti vuoti come "Skip"
		}
		voteCounts[target]++
	}

	// 2. Troviamo chi ha preso più voti
	var maxVotes int
	var candidates []string

	for target, count := range voteCounts {
		if count > maxVotes {
			maxVotes = count
			candidates = []string{target} // Nuovo leader assoluto
		} else if count == maxVotes {
			candidates = append(candidates, target) // Pareggio temporaneo
		}
	}

	// 3. Gestiamo i pareggi o le vittorie dello SKIP
	// Se l'array ha più di un elemento (pareggio perfetto) o se ha vinto lo SKIP, non muore nessuno.
	if len(candidates) != 1 || candidates[0] == "SKIP" {
		return "", nil
	}

	// 4. Abbiamo un condannato!
	eliminatedID := candidates[0]
	err := g.eliminatePlayer(eliminatedID)
	if err != nil {
		return "", err
	}

	return eliminatedID, nil
}

// eliminatePlayer è un metodo privato che uccide il giocatore ed emette l'evento
func (g *Game) eliminatePlayer(playerID string) error {
	idx := g.getPlayerIndex(playerID)
	if idx == -1 {
		return errors.New("giocatore da eliminare non trovato")
	}
	if g.Players[idx].Status == "DEAD" {
		return errors.New("il giocatore è già morto")
	}

	// Cambiamo lo stato interno
	g.Players[idx].Status = "DEAD"

	// Avvisiamo il mondo esterno
	g.RecordEvent(event.PlayerEliminated{
		BaseEvent: event.BaseEvent{OccurredAt: time.Now()},
		GameID:    g.ID,
		PlayerID:  playerID,
	})

	return nil
}

// GetPlayerRole restituisce il ruolo di un giocatore
func (g *Game) GetPlayerRole(playerID string) string {
	idx := g.getPlayerIndex(playerID)
	if idx != -1 {
		return string(g.Players[idx].Role)
	}
	return ""
}

// StartGuessingPhase mette in pausa il gioco e aspetta la parola dall'impostore
func (g *Game) StartGuessingPhase() error {
	if g.State != StatePlaying {
		return errors.New("la partita non è in corso")
	}
	
	// Impostiamo la nuova fase (assicurati di aggiungere "GUESSING_WORD" nel tuo valueobject!)
	g.CurrentTurn.Phase = "GUESSING_WORD" 

	g.RecordEvent(event.PhaseChanged{
		BaseEvent: event.BaseEvent{OccurredAt: time.Now()},
		GameID:    g.ID,
		NewPhase:  "GUESSING_WORD",
		Timer:     30, 
	})

	return nil
}

// CheckSecretWord verifica se la parola è corretta
func (g *Game) CheckSecretWord(guessedWord string) bool {
    // Convertiamo in stringa il valueobject SecretWord per fare il paragone
	actualWord := string(g.SecretWord) 
	
	// Confrontiamo ignorando le maiuscole/minuscole
	return strings.ToLower(guessedWord) == strings.ToLower(actualWord)
}