import { SessionRepository } from '../domain/SessionRepository';
import { EngineGateway } from '../domain/EngineGateway';
import { Event } from '../domain/Event';

export class RoutingService {
    constructor(
        private sessionRepository: SessionRepository,
        private engineGateway: EngineGateway
    ) {}

    async handleClientEvent(userId: string, event: Event): Promise<void> {
        const payload = event.payload || {};

        switch (event.type) {
            case 'START_GAME':
                const impostorsCount = parseInt(payload.requestedImpostors, 10) || 1;
                const players = Array.isArray(payload.playerIds) ? payload.playerIds : [];
                
                await this.engineGateway.createGame(
                    String(payload.gameId),
                    players,
                    impostorsCount
                );
                break;

            case 'CAST_VOTE':
                await this.engineGateway.castVote(
                    String(payload.gameId),
                    userId, 
                    payload.targetId ? String(payload.targetId) : "" 
                );
                break;

            case 'ADVANCE_PHASE':
                await this.engineGateway.advanceToVoting(String(payload.gameId));
                break;

            case 'END_VOTING':
                await this.engineGateway.resolveVoting(String(payload.gameId));
                break;

            default:
                console.log(`[Routing] Evento ${event.type} ignorato o non destinato a Go.`);
        }
    }
}