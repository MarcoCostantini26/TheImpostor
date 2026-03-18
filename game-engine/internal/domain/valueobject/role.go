package valueobject

type Role string

const (
	RoleCrewmate Role = "CREWMATE"
	RoleImpostor Role = "IMPOSTOR"
)

func (r Role) IsImpostor() bool {
	return r == RoleImpostor
}