import { EngineGateway } from '../domain/EngineGateway';
import { Event } from '../domain/Event';

export class HttpEngineAdapter implements EngineGateway {
    private readonly engineUrl: string;

    constructor() {
        // L'URL punta al servizio Go come definito nell'ambiente Docker [cite: 442, 557]
        this.engineUrl = process.env.ENGINE_URL || 'http://localhost:8081';
    }

    async sendGameAction(userId: string, event: Event): Promise<void> {
        console.log(`[Adapter-Go] Inoltro ${event.type} per l'utente ${userId}`);

        try {
            const response = await fetch(`${this.engineUrl}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    type: event.type,
                    payload: event.payload
                })
            });

            if (!response.ok) {
                throw new Error(`Il motore Go ha risposto con status: ${response.status}`);
            }
        } catch (error) {
            console.error(`[Adapter-Go] Errore di rete verso l'Engine:`, error);
            throw error;
        }
    }
}