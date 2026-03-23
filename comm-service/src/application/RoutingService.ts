import { SessionRepository } from '../domain/SessionRepository';
import { EngineGateway } from '../domain/EngineGateway';
import { Event } from '../domain/Event';

export class RoutingService {
    constructor(
        private sessionRepository: SessionRepository,
        private engineGateway: EngineGateway // Iniettiamo la porta 
    ) {}

    async handleClientEvent(userId: string, event: Event): Promise<void> {
        // Definiamo quali eventi devono andare verso il modulo Engine (Go) [cite: 174]
        const gameActions = ['SUBMIT_CLUE', 'CAST_VOTE', 'START_GAME'];

        if (gameActions.includes(event.type)) {
            await this.engineGateway.sendGameAction(userId, event);
        } else {
            console.log(`[Routing] Evento ${event.type} ricevuto, ma non destinato all'Engine.`);
        }
    }
}