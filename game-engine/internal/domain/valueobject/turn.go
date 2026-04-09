package valueobject

type Phase string

const (
	PhaseDiscussion Phase = "DISCUSSION"
	PhaseVoting     Phase = "VOTING"
	PhaseGuessing	Phase = "GUESSING_WORD"
)

type Turn struct {
	RoundNumber int
	Phase       Phase
	Timer       int
}