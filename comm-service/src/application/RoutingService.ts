import { SessionRepository } from '../domain/SessionRepository';
import { EngineGateway } from '../domain/EngineGateway';
import { Event } from '../domain/Event';

export class RoutingService {
    constructor(
        private sessionRepository: SessionRepository,
        private engineGateway: EngineGateway // Iniettiamo la porta 
    ) {}

    async handleClientEvent(userId: string, event: Event): Promise<void> {
        console.log(`[Routing] ⚙️ Inizio "${event.type}" per: ${userId}`);
        const payload = event.payload || {};

        try {
            switch (event.type) {
                case 'START_GAME':
                    await this.engineGateway.createGame(
                        String(payload.gameId),
                        Array.isArray(payload.playerIds) ? payload.playerIds : [],
                        Number(payload.requestedImpostors) || 1
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

                default:
                    console.log(`[Routing] ⚠️ Evento non gestito: ${event.type}`);
            }
            // Questo log ti conferma che l'adapter ha FINITO
            console.log(`[Routing] ✅ Operazione "${event.type}" completata.`);
        } catch (error: any) {
            console.error(`[Routing] ❌ Errore durante "${event.type}": ${error.message}`);
            throw error;
        }
    }
}