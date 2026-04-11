import { SessionRepository } from '../domain/SessionRepository';
import { EngineGateway } from '../domain/EngineGateway';
import { Event } from '../domain/Event';

export class RoutingService {
    constructor(
        private sessionRepository: SessionRepository,
        private engineGateway: EngineGateway
    ) {}

    async handleClientEvent(userId: string, event: Event): Promise<void> {
        console.log(`[Routing] ⚙️ Inizio "${event.type}" per: ${userId}`);
        const payload = event.payload || {};

        try {
            switch (event.type) {
                case 'START_GAME':
                    await this.engineGateway.createGame(
                        String(payload.gameId || payload.roomCode || payload.roomId),
                        Array.isArray(payload.playerIds) ? payload.playerIds : [],
                        Number(payload.requestedImpostors) || 1,
                        String(payload.secretWord || "")
                    );
                    break;

                case 'GUESS_WORD':
                    await this.engineGateway.guessSecretWord(
                        String(payload.gameId || payload.roomId),
                        userId, 
                        String(payload.guessedWord || "")
                    );
                    break;

                case 'CAST_VOTE':
                    await this.engineGateway.castVote(
                        String(payload.gameId),
                        userId, 
                        String(payload.targetId || "")
                    );
                    break;

                case 'ADVANCE_PHASE':
                    await this.engineGateway.advanceToVoting(String(payload.gameId));
                    break;

                case 'RESOLVE_VOTING':
                    await this.engineGateway.resolveVoting(String(payload.gameId));
                    break;

                default:
                    console.log(`[Routing] Evento non gestito: ${event.type}`);
            }
            console.log(`[Routing] ✅ Operazione "${event.type}" completata.`);
        } catch (error: any) {
            console.error(`[Routing] ❌ Errore durante "${event.type}": ${error.message}`);
            throw error;
        }
    }
}