import { Event } from '../domain/ValueObjects';
import { SessionRepository } from '../domain/SessionRepository';

export class RoutingService {
    constructor(private sessionRepository: SessionRepository) {}

    async handleClientEvent(userId: string, event: Event): Promise<void> {
        const session = await this.sessionRepository.findByUserId(userId);
        
        if (!session) {
            console.warn(`Nessuna sessione trovata per l'utente ${userId}`);
            return;
        }

        console.log(`Ricevuto evento [${event.type}] dall'utente ${userId}. Pronto per il routing verso i servizi di backend.`);
        
        // Nel livello Infrastructure, questo metodo invocherà le chiamate HTTP (REST/JSON)
        // verso i contesti Lobby (Java) o Engine (Go).
    }
}