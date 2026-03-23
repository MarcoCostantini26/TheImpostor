package aggregate

import (
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
	Hint        valueobject.Hint
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

// AssignSecrets imposta la parola segreta per i Crewmate e l'indizio per l'Impostore.
// (Verrà chiamato all'inizio del round effettivo)
func (g *Game) AssignSecrets(secretWord valueobject.SecretWord, hint valueobject.Hint) error {
	if g.State != StatePlaying {
		return errors.New("impossibile assegnare le parole: la partita non è in corso")
	}
	
	g.SecretWord = secretWord
	g.Hint = hint
	
	return nil
}

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