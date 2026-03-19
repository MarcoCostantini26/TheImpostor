package valueobject

type Phase string

const (
	PhaseDiscussion Phase = "DISCUSSION"
	PhaseVoting     Phase = "VOTING"
)

type Turn struct {
	RoundNumber int
	Phase       Phase
	Timer       int
}