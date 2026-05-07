package aggregate

import (
	"errors"
	"strings"
	"time"

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
	ID             string
	State          string
	Players        []entity.Player
	CurrentTurn    valueobject.Turn
	SecretWord     valueobject.SecretWord
	Hint           valueobject.Hint
	Votes          []valueobject.Vote
	RoundStartedAt time.Time
	domainEvents   []event.DomainEvent
}

func (g *Game) RecordEvent(e event.DomainEvent) {
	g.domainEvents = append(g.domainEvents, e)
}

func (g *Game) GetEvents() []event.DomainEvent {
	return g.domainEvents
}

func (g *Game) ClearEvents() {
	g.domainEvents = nil
}

func (g *Game) AdvanceToVoting() error {
	if g.State != StatePlaying {
		return errors.New("la partita non è in corso")
	}
	if g.CurrentTurn.Phase != valueobject.PhaseDiscussion {
		return errors.New("il gioco non è in fase di discussione")
	}

	g.CurrentTurn.Phase = valueobject.PhaseVoting
	g.CurrentTurn.Timer = 60

	g.Votes = make([]valueobject.Vote, 0)

	g.RecordEvent(event.PhaseChanged{
		BaseEvent: event.BaseEvent{OccurredAt: time.Now()},
		GameID:    g.ID,
		NewPhase:  string(valueobject.PhaseVoting),
		Timer:     60,
	})

	return nil
}

func (g *Game) CastVote(voterID string, targetID string) error {
	if g.State != StatePlaying {
		return errors.New("la partita non è in corso")
	}

	if g.CurrentTurn.Phase != valueobject.PhaseVoting {
		return errors.New("non è il momento di votare")
	}

	voterIndex := g.getPlayerIndex(voterID)
	if voterIndex == -1 {
		return errors.New("giocatore votante non trovato")
	}
	if g.Players[voterIndex].Status != "ALIVE" {
		return errors.New("i giocatori eliminati non possono votare")
	}

	vote := valueobject.Vote{
		VoterID:  voterID,
		TargetID: targetID,
	}
	g.Votes = append(g.Votes, vote)

	g.RecordEvent(event.PlayerVoted{
		BaseEvent: event.BaseEvent{OccurredAt: time.Now()},
		GameID:    g.ID,
		VoterID:   voterID,
	})

	return nil
}

func (g *Game) getPlayerIndex(playerID string) int {
	for i, p := range g.Players {
		if p.ID == playerID {
			return i
		}
	}
	return -1
}

func (g *Game) EndGame(winningTeam string) error {
	if g.State == StateEnded {
		return errors.New("la partita è già finita")
	}

	g.State = StateEnded

	g.RecordEvent(event.GameEnded{
		BaseEvent:   event.BaseEvent{OccurredAt: time.Now()},
		GameID:      g.ID,
		WinningTeam: winningTeam,
	})

	return nil
}

func (g *Game) ResolveVoting() (string, error) {
	if g.State != StatePlaying {
		return "", errors.New("la partita non è in corso")
	}
	if g.CurrentTurn.Phase != valueobject.PhaseVoting {
		return "", errors.New("non siamo in fase di votazione")
	}

	voteCounts := make(map[string]int)
	for _, v := range g.Votes {
		target := v.TargetID
		if target == "" {
			target = "SKIP" 
		}
		voteCounts[target]++
	}

	var maxVotes int
	var candidates []string

	for target, count := range voteCounts {
		if count > maxVotes {
			maxVotes = count
			candidates = []string{target} 
		} else if count == maxVotes {
			candidates = append(candidates, target)
		}
	}

	if len(candidates) != 1 || candidates[0] == "SKIP" {
		return "", nil
	}

	eliminatedID := candidates[0]
	err := g.eliminatePlayer(eliminatedID)
	if err != nil {
		return "", err
	}

	return eliminatedID, nil
}

func (g *Game) eliminatePlayer(playerID string) error {
	idx := g.getPlayerIndex(playerID)
	if idx == -1 {
		return errors.New("giocatore da eliminare non trovato")
	}
	if g.Players[idx].Status == "DEAD" {
		return errors.New("il giocatore è già morto")
	}

	g.Players[idx].Status = "DEAD"

	g.RecordEvent(event.PlayerEliminated{
		BaseEvent: event.BaseEvent{OccurredAt: time.Now()},
		GameID:    g.ID,
		PlayerID:  playerID,
	})

	return nil
}

func (g *Game) GetPlayerRole(playerID string) string {
	idx := g.getPlayerIndex(playerID)
	if idx != -1 {
		return string(g.Players[idx].Role)
	}
	return ""
}

func (g *Game) StartGuessingPhase() error {
	if g.State != StatePlaying {
		return errors.New("la partita non è in corso")
	}

	g.CurrentTurn.Phase = "GUESSING_WORD"

	g.RecordEvent(event.PhaseChanged{
		BaseEvent: event.BaseEvent{OccurredAt: time.Now()},
		GameID:    g.ID,
		NewPhase:  "GUESSING_WORD",
		Timer:     30,
	})

	return nil
}

func (g *Game) StartNewRound() {
	g.CurrentTurn.RoundNumber++
	g.CurrentTurn.Phase = valueobject.PhaseDiscussion
	g.CurrentTurn.Timer = 0
	g.Votes = make([]valueobject.Vote, 0)
	g.RoundStartedAt = time.Now()
}

func (g *Game) GetImpostorID() string {
	for _, p := range g.Players {
		if p.Role.IsImpostor() {
			return p.ID
		}
	}
	return ""
}

func (g *Game) GetImpostorIDs() []string {
	ids := []string{}
	for _, p := range g.Players {
		if p.Role.IsImpostor() {
			ids = append(ids, p.ID)
		}
	}
	return ids
}

func (g *Game) CheckSecretWord(guessedWord string) bool {
	actualWord := string(g.SecretWord)

	return strings.ToLower(guessedWord) == strings.ToLower(actualWord)
}
